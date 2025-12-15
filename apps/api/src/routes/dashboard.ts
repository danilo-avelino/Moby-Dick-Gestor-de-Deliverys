import { FastifyInstance } from 'fastify';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import type { ApiResponse } from 'types';

export async function dashboardRoutes(fastify: FastifyInstance) {
    // Get dashboard KPIs
    fastify.get('/kpis', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get dashboard KPIs',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const today = new Date();
        today.setDate(today.getDate() - 1); // User wants "Today" to be "Yesterday" (completed day)
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get CMV snapshots
        const [todaySnapshot, yesterdaySnapshot, weekSnapshots, monthSnapshots] = await Promise.all([
            prisma.cMVSnapshot.findFirst({
                where: { restaurantId: request.user!.costCenterId, date: today },
            }),
            prisma.cMVSnapshot.findFirst({
                where: { restaurantId: request.user!.costCenterId, date: yesterday },
            }),
            prisma.cMVSnapshot.findMany({
                where: {
                    restaurantId: request.user!.costCenterId,
                    date: { gte: weekStart, lte: today },
                },
            }),
            prisma.cMVSnapshot.findMany({
                where: {
                    restaurantId: request.user!.costCenterId,
                    date: { gte: monthStart, lte: today },
                },
            }),
        ]);

        const weekRevenue = weekSnapshots.reduce((sum, s) => sum + s.revenue, 0);
        const weekOrders = weekSnapshots.reduce((sum, s) => sum + s.orderCount, 0);
        const monthRevenue = monthSnapshots.reduce((sum, s) => sum + s.revenue, 0);
        const monthOrders = monthSnapshots.reduce((sum, s) => sum + s.orderCount, 0);

        // Calculate trends
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);

        const prevWeekSnapshots = await prisma.cMVSnapshot.findMany({
            where: {
                restaurantId: request.user!.costCenterId,
                date: { gte: prevWeekStart, lt: weekStart },
            },
        });

        const prevWeekRevenue = prevWeekSnapshots.reduce((sum, s) => sum + s.revenue, 0);
        const revenueTrend = prevWeekRevenue > 0
            ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100
            : 0;

        // Get alerts
        const [unreadAlerts, criticalAlerts] = await Promise.all([
            prisma.alert.count({
                where: {
                    restaurantId: request.user!.costCenterId,
                    isRead: false,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
            }),
            prisma.alert.count({
                where: {
                    restaurantId: request.user!.costCenterId,
                    isRead: false,
                    severity: 'CRITICAL',
                },
            }),
        ]);

        // Get stock alerts
        const [lowStockCount, expiringCount] = await Promise.all([
            prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "Product"
        WHERE "restaurantId" = ${request.user!.costCenterId}
          AND "isActive" = true
          AND "currentStock" <= "reorderPoint"
      `.then((r) => Number(r[0]?.count || 0)),
            prisma.stockBatch.count({
                where: {
                    product: { restaurantId: request.user!.costCenterId },
                    remainingQty: { gt: 0 },
                    expirationDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        // Get restaurant target
        const restaurant = await prisma.costCenter.findUnique({
            where: { id: request.user!.costCenterId! },
            select: { targetCmvPercent: true },
        });

        // Calculate averages
        const weekCmv = weekSnapshots.length > 0
            ? weekSnapshots.reduce((sum, s) => sum + s.realPercent, 0) / weekSnapshots.length
            : 0;
        const monthCmv = monthSnapshots.length > 0
            ? monthSnapshots.reduce((sum, s) => sum + s.realPercent, 0) / monthSnapshots.length
            : 0;

        const response: ApiResponse = {
            success: true,
            data: {
                revenue: {
                    today: todaySnapshot?.revenue || 0,
                    yesterday: yesterdaySnapshot?.revenue || 0,
                    thisWeek: weekRevenue,
                    thisMonth: monthRevenue,
                    trend: revenueTrend,
                },
                orders: {
                    today: todaySnapshot?.orderCount || 0,
                    yesterday: yesterdaySnapshot?.orderCount || 0,
                    thisWeek: weekOrders,
                    thisMonth: monthOrders,
                    trend: 0,
                },
                avgTicket: {
                    today: todaySnapshot?.avgTicket || 0,
                    thisWeek: weekOrders > 0 ? weekRevenue / weekOrders : 0,
                    thisMonth: monthOrders > 0 ? monthRevenue / monthOrders : 0,
                    trend: 0,
                },
                cmv: {
                    today: todaySnapshot?.realPercent || 0,
                    thisWeek: weekCmv,
                    thisMonth: monthCmv,
                    target: restaurant?.targetCmvPercent || 30,
                    trend: 0,
                },
                alerts: {
                    unread: unreadAlerts,
                    critical: criticalAlerts,
                },
                stockAlerts: {
                    lowStock: lowStockCount,
                    expiring: expiringCount,
                },
            },
        };

        return reply.send(response);
    });

    // Get top selling items
    fastify.get<{ Querystring: { limit?: string; period?: string } }>('/top-selling', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get top selling items',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const limit = parseInt(request.query.limit || '5', 10);
        const period = request.query.period || 'week';

        let startDate = new Date();
        if (period === 'day') startDate.setDate(startDate.getDate() - 1);
        else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
        else startDate.setMonth(startDate.getMonth() - 1);

        // Get latest menu analysis
        const analysis = await prisma.menuAnalysis.findFirst({
            where: {
                restaurantId: request.user!.costCenterId,
                periodStart: { gte: startDate },
            },
            include: {
                items: {
                    orderBy: { revenue: 'desc' },
                    take: limit,
                    include: {
                        recipe: {
                            select: { id: true, name: true, imageUrl: true, currentPrice: true },
                        },
                    },
                },
            },
            orderBy: { periodEnd: 'desc' },
        });

        if (!analysis) {
            // Return recipes with estimated data
            const recipes = await prisma.recipe.findMany({
                where: {
                    restaurantId: request.user!.costCenterId,
                    isActive: true,
                },
                take: limit,
                orderBy: { currentPrice: 'desc' },
                select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    currentPrice: true,
                    costPerUnit: true,
                },
            });

            const response: ApiResponse = {
                success: true,
                data: recipes.map((r) => ({
                    recipe: r,
                    quantity: 0,
                    revenue: 0,
                    marginPercent: r.currentPrice && r.costPerUnit
                        ? ((r.currentPrice - r.costPerUnit) / r.currentPrice) * 100
                        : 0,
                })),
            };

            return reply.send(response);
        }

        const response: ApiResponse = {
            success: true,
            data: analysis.items.map((item) => ({
                recipe: item.recipe,
                quantity: item.quantitySold,
                revenue: item.revenue,
                marginPercent: item.marginPercent,
            })),
        };

        return reply.send(response);
    });

    // Get revenue chart data
    fastify.get<{ Querystring: { period?: string } }>('/revenue-chart', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get revenue chart data',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const period = request.query.period || 'week';

        let startDate = new Date();
        if (period === 'week') startDate.setDate(startDate.getDate() - 7);
        else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else startDate.setMonth(startDate.getMonth() - 3);

        const snapshots = await prisma.cMVSnapshot.findMany({
            where: {
                restaurantId: request.user!.costCenterId,
                date: { gte: startDate },
            },
            orderBy: { date: 'asc' },
            select: {
                date: true,
                revenue: true,
                orderCount: true,
                realPercent: true,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: snapshots.map((s) => ({
                date: s.date.toISOString().split('T')[0],
                revenue: s.revenue,
                orders: s.orderCount,
                cmv: s.realPercent,
            })),
        };

        return reply.send(response);
    });

    // Get recent activity
    fastify.get('/activity', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get recent activity',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const [movements, alerts, goals] = await Promise.all([
            prisma.stockMovement.findMany({
                where: { product: { restaurantId: request.user!.costCenterId } },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true } },
                    user: { select: { firstName: true, lastName: true } },
                },
            }),
            prisma.alert.findMany({
                where: { restaurantId: request.user!.costCenterId },
                take: 5,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.goal.findMany({
                where: {
                    restaurantId: request.user!.costCenterId,
                    achievedAt: { not: null },
                },
                take: 3,
                orderBy: { achievedAt: 'desc' },
                include: {
                    user: { select: { firstName: true, lastName: true } },
                },
            }),
        ]);

        const activities = [
            ...movements.map((m) => ({
                type: 'stock_movement',
                title: `${m.type === 'IN' ? 'Entrada' : 'Saída'} de estoque`,
                description: `${m.quantity} ${m.unit} de ${m.product.name}`,
                user: m.user ? `${m.user.firstName} ${m.user.lastName}` : null,
                timestamp: m.createdAt.toISOString(),
            })),
            ...alerts.map((a) => ({
                type: 'alert',
                title: a.title,
                description: a.message,
                severity: a.severity,
                timestamp: a.createdAt.toISOString(),
            })),
            ...goals.map((g) => ({
                type: 'goal_achieved',
                title: `Meta atingida: ${g.name}`,
                description: g.user ? `Por ${g.user.firstName} ${g.user.lastName}` : 'Meta da equipe',
                timestamp: g.achievedAt!.toISOString(),
            })),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const response: ApiResponse = {
            success: true,
            data: activities.slice(0, 10),
        };

        return reply.send(response);
    });
}
