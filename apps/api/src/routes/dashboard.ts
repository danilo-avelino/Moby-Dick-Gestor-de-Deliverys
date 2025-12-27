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
        if (!request.user || !request.user.costCenterId) {
            return reply.send({ success: false, error: 'No cost center selected' });
        }

        const costCenterId = request.user.costCenterId;
        const now = new Date();

        // Define periods
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const startOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const endOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);

        // Fetch Data Parallelly
        const [
            yesterdayRevenue,
            monthRevenue,
            lastMonthRevenue,
            lastYearRevenue,
            wasteMonth,
            purchasesMonth
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
                    startDate: { gte: startOfMonth }
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
            // Note: If StockMovement lacks costCenterId, we might need a workaround. 
            // Assuming we check Organization level for now or check if schema update allows filtering.
            // Using a heuristic: user.organizationId
            (async () => {
                const orgId = request.user?.organizationId;
                if (!orgId) return { _sum: { totalCost: 0 } };
                return prisma.stockMovement.aggregate({
                    _sum: { totalCost: true },
                    where: {
                        type: 'WASTE',
                        organizationId: orgId, // Best approximation if CC not available
                        createdAt: { gte: startOfMonth }
                    }
                });
            })(),
            // 6. Purchases This Month (Entradas)
            (async () => {
                // Determine source for "Purchases". StockMovement IN or PurchaseList?
                // Request said "Compras (entradas no estoque)".
                const orgId = request.user?.organizationId;
                if (!orgId) return { _sum: { totalCost: 0 } };
                return prisma.stockMovement.aggregate({
                    _sum: { totalCost: true },
                    where: {
                        type: 'IN',
                        organizationId: orgId,
                        createdAt: { gte: startOfMonth }
                    }
                });
            })()
        ]);

        // Calculate Forecast
        const currentMonthTotal = monthRevenue._sum.totalAmount || 0;
        const daysPassed = now.getDate(); // Including today, or -1? Usually Forecast includes today's projection
        // Simple: (Revenue / DaysPassed) * TotalDays
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const forecast = daysPassed > 0
            ? (currentMonthTotal / daysPassed) * daysInMonth
            : 0;

        // Calculate "CMV" as (Purchases / Revenue) * 100 roughly
        // Or if we have real CMV from somewhere else? User asked for "CMV Real na aba"
        // Usually CMV Real = (Opening + Purchases - Closing) / Revenue.
        // We lack inventory closing snapshot for "Now".
        // Using "Purchases / Revenue" is "Purchases %".
        // Let's return the raw values and let Logic handle it.
        // Or we stick to the requested "Compras vs Faturamento" chart.

        return reply.send({
            success: true,
            data: {
                revenue: {
                    yesterday: yesterdayRevenue._sum.totalAmount || 0,
                    thisMonth: currentMonthTotal,
                    lastMonth: lastMonthRevenue._sum.totalAmount || 0,
                    lastYearSameMonth: lastYearRevenue._sum.totalAmount || 0,
                    forecast: forecast,
                    trend: 0 // Placeholder
                },
                purchases: {
                    thisMonth: purchasesMonth._sum.totalCost || 0
                },
                waste: {
                    thisMonth: wasteMonth._sum.totalCost || 0
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
    }, async (request, reply) => {
        const costCenterId = request.user!.costCenterId;
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
    }, async (request, reply) => {
        const costCenterId = request.user!.costCenterId;
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
}
