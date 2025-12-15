
import { FastifyInstance } from 'fastify';
import { prisma } from 'database';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from 'types';
import dayjs from 'dayjs';

export async function platformRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authenticate);
    app.addHook('preHandler', requireRole(UserRole.SUPER_ADMIN));

    // Dashboard Overview Stats
    app.get('/overview', async (request, reply) => {
        const todayStart = dayjs().startOf('day').toDate();
        const weekStart = dayjs().subtract(7, 'days').toDate();
        const monthStart = dayjs().subtract(30, 'days').toDate();

        const [
            activeOrgs,
            activeEvents,
            ticketsSoldWeek,
            revenueWeek,
            failedWebhooks24h,
            failedPayments24h
        ] = await Promise.all([
            // Active Orgs
            prisma.organization.count({ where: { status: 'ACTIVE' } }),

            // Active Events (Published and happening or future)
            prisma.event.count({
                where: {
                    status: 'PUBLISHED',
                    startsAt: { gte: todayStart }
                }
            }),

            // Tickets Sold (Last 7 days) (Mock logic if Ticket model is fresh/empty)
            prisma.ticket.aggregate({
                where: { createdAt: { gte: weekStart } },
                _sum: { quantitySold: true }
            }),

            // Revenue (Last 7 days) (Mock logic or sum of tickets)
            prisma.ticket.aggregate({
                where: { createdAt: { gte: weekStart } },
                _sum: { price: true } // Simplified revenue calc
            }),

            // Failed Webhooks
            prisma.webhookLog.count({
                where: {
                    status: 'FAILURE',
                    createdAt: { gte: todayStart }
                }
            }),

            // Failed Payments (Mock or valid query if payment log exists)
            0
        ]);

        return {
            success: true,
            data: {
                kpis: {
                    activeOrgs,
                    activeEvents,
                    ticketsSoldWeek: ticketsSoldWeek._sum.quantitySold || 0,
                    revenueWeek: revenueWeek._sum.price || 0,
                    failedWebhooks24h,
                    failedPayments24h
                },
                health: {
                    apiLatency: 45, // ms (Mock)
                    jobsPending: 0,
                    webhooksSuccessRate: 99.8,
                    status: 'OPERATIONAL'
                }
            }
        };
    });

    // List Organizations with Platform Layout data
    app.get('/organizations', async (request, reply) => {
        const organizations = await prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { events: true, users: true }
                },
                users: {
                    where: { role: 'DIRETOR' },
                    take: 1
                },
                costCenters: {
                    take: 1
                    // Removed select plan because CostCenter doesn't have plan, Organization usually handles subscription or it's on CostCenter?
                    // Checking schema: CostCenter has NO plan field. Organization has NO plan field.
                    // Subscription is likely managed differently or not implemented in this schema yet. 
                    // I will comment out plan selection for now to avoid errors.
                }
            }
        });

        const enriched = organizations.map(org => {
            const primaryCostCenter = org.costCenters[0];
            const director = org.users[0];

            let billingStatus = 'ACTIVE';
            // if (!primaryCostCenter) billingStatus = 'INCOMPLETE';
            // Mock billing status for now as schema doesn't have subscription info

            // Platform Health Check
            let health = 'OK';
            if (!director || !primaryCostCenter) health = 'CRITICAL';

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                ownerName: director ? `${director.firstName} ${director.lastName}` : 'N/A',
                ownerEmail: director?.email,
                plan: 'Enterprise', // Mock
                billingStatus,
                eventCount: org._count.events,
                health,
                createdAt: org.createdAt
            };
        });

        return { success: true, data: enriched };
    });

    // List Events (Aggregated with Filters & KPIs)
    app.get('/events', async (request, reply) => {
        const {
            period,
            status,
            orgId,
            search,
            noSales,
            page = 1,
            limit = 20
        } = request.query as any;

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Build Where Clause
        const where: any = {};

        // Date Filters
        const now = dayjs();
        if (period === 'today') {
            where.startsAt = {
                gte: now.startOf('day').toDate(),
                lte: now.endOf('day').toDate()
            };
        } else if (period === 'next_7') {
            where.startsAt = {
                gte: now.toDate(),
                lte: now.add(7, 'day').toDate()
            };
        } else if (period === 'past_30') {
            where.startsAt = {
                gte: now.subtract(30, 'day').toDate(),
                lte: now.toDate()
            };
        }

        // Status Filter
        if (status && status !== 'ALL') {
            where.status = status;
        }

        // Organization Filter
        if (orgId) {
            where.organizationId = orgId;
        }

        // Search Filter (Name or Org Name)
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { organization: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        // No Sales Filter
        if (noSales === 'true') {
            where.ticketsSold = 0;
            where.status = 'PUBLISHED';
        }

        try {
            // Execute Queries in Parallel
            const [events, total] = await Promise.all([
                prisma.event.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { startsAt: 'asc' }, // Soonest first for operational view
                    include: {
                        organization: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                }),
                prisma.event.count({ where })
            ]);

            // Calculate KPIs (Global or Filtered?) -> Let's do Global Context KPIs for the cards
            // independent of filters for now, or maybe applied? usually dashboard cards are global context
            // unless filtered. Let's stick to "Platform Overview" context for cards.
            const kpiStart = dayjs().subtract(30, 'days').toDate();
            const [
                eventsToday,
                eventsNext7,
                published30d,
                totalRevenue
            ] = await Promise.all([
                prisma.event.count({
                    where: {
                        startsAt: {
                            gte: dayjs().startOf('day').toDate(),
                            lte: dayjs().endOf('day').toDate()
                        }
                    }
                }),
                prisma.event.count({
                    where: {
                        startsAt: {
                            gte: dayjs().toDate(),
                            lte: dayjs().add(7, 'day').toDate()
                        }
                    }
                }),
                prisma.event.count({
                    where: {
                        status: 'PUBLISHED',
                        createdAt: { gte: kpiStart }
                    }
                }),
                // Aggregate revenue from ALL events (approximate GMV)
                prisma.event.aggregate({
                    _sum: { revenue: true, ticketsSold: true }
                })
            ]);

            // Enhance events with "Health" logic
            const enrichedEvents = events.map(event => {
                let health = 'OK';
                const daysToStart = dayjs(event.startsAt).diff(dayjs(), 'day');

                if (event.status === 'PUBLISHED') {
                    if (daysToStart < 3 && event.ticketsSold === 0) {
                        health = 'CRITICAL';
                    } else if (daysToStart < 7 && event.ticketsSold < 10) {
                        health = 'ATTENTION'; // Slow sales
                    }
                }

                // Check past events without revenue?
                if (event.status === 'ENDED' && event.ticketsSold === 0) {
                    health = 'POOR_PERFORMANCE';
                }

                return {
                    ...event,
                    health
                };
            });

            // Alerts / Insights
            // 1. Published events > 7 days ago with 0 sales
            const stuckEvents = await prisma.event.count({
                where: {
                    status: 'PUBLISHED',
                    ticketsSold: 0,
                    createdAt: { lte: dayjs().subtract(7, 'days').toDate() }
                }
            });

            // 2. Webhook Failures (Risk)
            const webhooksFailed = await prisma.webhookLog.count({
                where: { status: 'FAILURE', createdAt: { gte: dayjs().subtract(24, 'hour').toDate() } }
            });

            return {
                success: true,
                data: {
                    items: enrichedEvents,
                    pagination: {
                        page: Number(page),
                        total,
                        totalPages: Math.ceil(total / take)
                    },
                    kpis: {
                        today: eventsToday,
                        next7: eventsNext7,
                        published30d,
                        totalTicketsSold: totalRevenue._sum?.ticketsSold || 0,
                        totalRevenue: totalRevenue._sum?.revenue || 0,
                    },
                    insights: {
                        stuckEvents,
                        webhooksFailed
                    }
                }
            };

        } catch (error) {
            console.error('Error fetching platform events:', error);
            return reply.status(500).send({ success: false, message: 'Failed to fetch events' });
        }
    });

    // Audit Logs
    app.get('/audit-logs', async (request, reply) => {
        const logs = await prisma.platformAuditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return { success: true, data: logs };
    });
}
