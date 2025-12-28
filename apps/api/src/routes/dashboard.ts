import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function dashboardRoutes(fastify: FastifyInstance) {
    // Get dashboard KPIs
    fastify.get<{ Querystring: { date?: string } }>('/kpis', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get dashboard KPIs',
            querystring: {
                type: 'object',
                properties: {
                    date: { type: 'string', format: 'date-time' }
                }
            },
            security: [{ bearerAuth: [] }],
        },
    }, async (request: FastifyRequest<{ Querystring: { date?: string } }>, reply: FastifyReply) => {
        if (!request.user || !request.user.costCenterId) {
            return reply.send({ success: false, error: 'No cost center selected' });
        }

        const costCenterId = request.user.costCenterId;
        // Use provided date or default to now
        const now = request.query.date ? new Date(request.query.date) : new Date();

        // Define periods
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        // Ensure accurate month calculations
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        endOfLastMonth.setHours(23, 59, 59, 999);

        const startOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const endOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);
        endOfSameMonthLastYear.setHours(23, 59, 59, 999);

        // Fetch Data Parallelly
        const [
            yesterdayRevenue,
            monthRevenue,
            lastMonthRevenue,
            lastYearRevenue,
            wasteMonth,
            lastMonthWaste,
            purchasesMonth,
            inventorySession,
            lastInventory,
            costCenter
        ] = await Promise.all([
            // 1. Yesterday's Revenue
            prisma.revenue.aggregate({
                _sum: { totalAmount: true },
                where: {
                    costCenterId,
                    startDate: { gte: yesterday, lte: yesterdayEnd }
                }
            }),
            // 2. This Month Revenue
            prisma.revenue.aggregate({
                _sum: { totalAmount: true },
                where: {
                    costCenterId,
                    startDate: { gte: startOfMonth, lte: endOfMonth }
                }
            }),
            // 3. Last Month Revenue
            prisma.revenue.aggregate({
                _sum: { totalAmount: true },
                where: {
                    costCenterId,
                    startDate: { gte: startOfLastMonth, lte: endOfLastMonth }
                }
            }),
            // 4. Last Year Same Month Revenue
            prisma.revenue.aggregate({
                _sum: { totalAmount: true },
                where: {
                    costCenterId,
                    startDate: { gte: startOfSameMonthLastYear, lte: endOfSameMonthLastYear }
                }
            }),
            // 5. Waste This Month (StockMovement type WASTE)
            (async () => {
                const orgId = request.user?.organizationId;
                if (!orgId) return { _sum: { totalCost: 0 } };
                return prisma.stockMovement.aggregate({
                    _sum: { totalCost: true },
                    where: {
                        type: 'WASTE',
                        organizationId: orgId,
                        createdAt: { gte: startOfMonth, lte: endOfMonth }
                    }
                });
            })(),
            // 6. Waste Last Month
            (async () => {
                const orgId = request.user?.organizationId;
                if (!orgId) return { _sum: { totalCost: 0 } };
                return prisma.stockMovement.aggregate({
                    _sum: { totalCost: true },
                    where: {
                        type: 'WASTE',
                        organizationId: orgId,
                        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
                    }
                });
            })(),
            // 7. Purchases This Month (Entradas)
            (async () => {
                const orgId = request.user?.organizationId;
                if (!orgId) return { _sum: { totalCost: 0 } };
                return prisma.stockMovement.aggregate({
                    _sum: { totalCost: true },
                    where: {
                        type: 'IN',
                        organizationId: orgId,
                        createdAt: { gte: startOfMonth, lte: endOfMonth }
                    }
                });
            })(),
            // 8. Stock Accuracy (Average Precision of Inventory Sessions)
            prisma.inventorySession.aggregate({
                _avg: { precision: true },
                where: {
                    costCenterId,
                    status: 'COMPLETED',
                    endDate: { gte: startOfMonth, lte: endOfMonth }
                }
            }),
            // 9. Last Inventory Date
            prisma.inventorySession.findFirst({
                where: {
                    costCenterId,
                    status: 'COMPLETED'
                },
                orderBy: { endDate: 'desc' },
                select: { endDate: true }
            }),
            // 10. Cost Center Targets
            prisma.costCenter.findUnique({
                where: { id: costCenterId },
                select: { targetCmvPercent: true, alertCmvThreshold: true }
            })
        ]);

        // Calculate Forecast
        const currentMonthTotal = monthRevenue._sum.totalAmount || 0;
        const lastMonthTotal = lastMonthRevenue._sum.totalAmount || 0;
        const wasteMonthTotal = wasteMonth._sum.totalCost || 0;
        const lastMonthWasteTotal = lastMonthWaste._sum.totalCost || 0;

        // Accurate Forecast Logic
        let forecast = 0;
        const realToday = new Date();
        const isCurrentMonth = now.getMonth() === realToday.getMonth() && now.getFullYear() === realToday.getFullYear();

        if (isCurrentMonth) {
            // If viewing current month, project based on days passed
            const daysPassed = realToday.getDate();
            const daysInMonth = new Date(realToday.getFullYear(), realToday.getMonth() + 1, 0).getDate();
            forecast = daysPassed > 0
                ? (currentMonthTotal / daysPassed) * daysInMonth
                : 0;
        } else {
            // If viewing past/future month, forecast is just the total (closed / planned)
            forecast = currentMonthTotal;
        }

        // Calculate Trends
        const revenueTrend = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
        const wasteTrend = lastMonthWasteTotal > 0 ? ((wasteMonthTotal - lastMonthWasteTotal) / lastMonthWasteTotal) * 100 : 0;

        return reply.send({
            success: true,
            data: {
                revenue: {
                    yesterday: yesterdayRevenue._sum.totalAmount || 0,
                    thisMonth: currentMonthTotal,
                    lastMonth: lastMonthTotal,
                    lastYearSameMonth: lastYearRevenue._sum.totalAmount || 0,
                    forecast: forecast,
                    trend: revenueTrend
                },
                purchases: {
                    thisMonth: purchasesMonth._sum.totalCost || 0
                },
                waste: {
                    thisMonth: wasteMonthTotal,
                    trend: wasteTrend
                },
                stockAccuracy: (inventorySession._avg.precision || 0) * 100,
                lastInventoryDate: lastInventory?.endDate || null,
                targets: {
                    cmv: costCenter?.targetCmvPercent || 30,
                    cmvAlert: costCenter?.alertCmvThreshold || 35
                }
            }
        });
    });

    // Get revenue chart data
    fastify.get<{ Querystring: { period?: string } }>('/revenue-chart', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get revenue chart data',
            security: [{ bearerAuth: [] }],
        },
    }, async (request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply) => {
        const costCenterId = request.user!.costCenterId || ''; // Validated by preHandler
        const period = request.query.period || 'week';
        const now = new Date();
        let startDate = new Date();

        if (period === 'week') startDate.setDate(now.getDate() - 7);
        else if (period === 'month') startDate.setMonth(now.getMonth() - 1);

        const revenues = await prisma.revenue.findMany({
            where: {
                costCenterId,
                startDate: { gte: startDate }
            },
            orderBy: { startDate: 'asc' }
        });

        // Group by Date
        const grouped = new Map<string, number>();
        // Initialize last 7 days with 0
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            grouped.set(d.toISOString().split('T')[0], 0);
        }

        revenues.forEach(r => {
            const dateKey = new Date(r.startDate).toISOString().split('T')[0];
            const current = grouped.get(dateKey) || 0;
            grouped.set(dateKey, current + r.totalAmount);
        });

        const chartData = Array.from(grouped.entries()).map(([date, revenue]) => ({
            date: date.split('-').slice(1).join('/'), // MM/DD
            revenue: revenue,
            purchases: 0 // Fetch purchases if needed for "Compras vs Faturamento"
        }));

        // Fetch daily purchases to overlay?
        // User asked "Compras vs Faturamento do mês ATUAL".
        // This chart endpoint handles "week" usually.
        // Let's enable "month" with Purchases.

        return reply.send({
            success: true,
            data: chartData
        });
    });

    fastify.get('/monthly-chart', {
        preHandler: [requireCostCenter],
        schema: { tags: ['Dashboard'] }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const costCenterId = request.user!.costCenterId || ''; // Validated by preHandler
        const orgId = request.user!.organizationId;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [revenues, purchases] = await Promise.all([
            prisma.revenue.findMany({
                where: { costCenterId, startDate: { gte: startOfMonth } }
            }),
            prisma.stockMovement.findMany({
                where: {
                    organizationId: orgId,
                    type: 'IN',
                    createdAt: { gte: startOfMonth }
                }
            })
        ]);

        // Group by day 1..31
        const daysMap = new Map<number, { revenue: number, purchases: number }>();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            daysMap.set(i, { revenue: 0, purchases: 0 });
        }

        revenues.forEach(r => {
            const day = new Date(r.startDate).getDate();
            if (daysMap.has(day)) {
                daysMap.get(day)!.revenue += r.totalAmount;
            }
        });

        purchases.forEach(p => {
            const day = new Date(p.createdAt).getDate();
            if (daysMap.has(day)) {
                daysMap.get(day)!.purchases += p.totalCost;
            }
        });

        const data = Array.from(daysMap.entries()).map(([day, val]) => ({
            day: day.toString(),
            revenue: val.revenue,
            purchases: val.purchases
        }));

        return reply.send({ success: true, data });
    });

    fastify.get('/stock-turnover', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Dashboard'],
            summary: 'Get stock turnover data (3 Months Aggregate)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const orgId = request.user?.organizationId;
        if (!orgId) return reply.send({ success: false, error: 'No organization' });

        const now = new Date();
        const results = [];

        // Fetch last 3 months (including current)
        for (let i = 2; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

            const movements = await prisma.stockMovement.findMany({
                where: {
                    organizationId: orgId,
                    createdAt: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    }
                },
                select: {
                    type: true,
                    totalCost: true
                }
            });

            let entries = 0;
            let exits = 0;

            movements.forEach(m => {
                if (m.type === 'IN' || m.type === 'RETURN') {
                    entries += m.totalCost;
                } else if (m.type === 'OUT' || m.type === 'WASTE' || m.type === 'PRODUCTION') {
                    exits += m.totalCost;
                }
            });

            const monthName = date.toLocaleString('pt-BR', { month: 'long' });
            results.push({
                label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                entries,
                exits
            });
        }

        return reply.send({ success: true, data: results });
    });
}
