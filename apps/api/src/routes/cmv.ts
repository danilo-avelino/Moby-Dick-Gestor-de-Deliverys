import { FastifyInstance } from 'fastify';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import type { ApiResponse } from 'types';

export async function cmvRoutes(fastify: FastifyInstance) {
    // Get CMV summary
    fastify.get<{
        Querystring: {
            period?: 'daily' | 'weekly' | 'monthly';
            startDate?: string;
            endDate?: string;
        };
    }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['CMV'],
            summary: 'Get CMV summary',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const period = request.query.period || 'daily';
        const endDate = request.query.endDate ? new Date(request.query.endDate) : new Date();

        let startDate: Date;
        if (request.query.startDate) {
            startDate = new Date(request.query.startDate);
        } else {
            startDate = new Date(endDate);
            if (period === 'daily') startDate.setDate(startDate.getDate() - 7);
            else if (period === 'weekly') startDate.setDate(startDate.getDate() - 28);
            else startDate.setMonth(startDate.getMonth() - 3);
        }

        const snapshots = await prisma.cMVSnapshot.findMany({
            where: {
                restaurantId: request.user!.restaurantId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { date: 'asc' },
        });

        // Calculate aggregates
        const totalRevenue = snapshots.reduce((sum, s) => sum + s.revenue, 0);
        const totalOrders = snapshots.reduce((sum, s) => sum + s.orderCount, 0);
        const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const totalTheoreticalCogs = snapshots.reduce((sum, s) => sum + s.theoreticalCogs, 0);
        const totalRealCogs = snapshots.reduce((sum, s) => sum + s.realCogs, 0);

        const avgTheoreticalPercent = totalRevenue > 0 ? (totalTheoreticalCogs / totalRevenue) * 100 : 0;
        const avgRealPercent = totalRevenue > 0 ? (totalRealCogs / totalRevenue) * 100 : 0;
        const avgWastePercent = avgRealPercent - avgTheoreticalPercent;
        const totalWasteAmount = totalRealCogs - totalTheoreticalCogs;

        // Calculate trend (compare to previous period)
        const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - periodDays);

        const prevSnapshots = await prisma.cMVSnapshot.findMany({
            where: {
                restaurantId: request.user!.restaurantId,
                date: {
                    gte: prevStartDate,
                    lt: startDate,
                },
            },
        });

        const prevRealPercent = prevSnapshots.length > 0
            ? prevSnapshots.reduce((sum, s) => sum + s.realPercent, 0) / prevSnapshots.length
            : avgRealPercent;

        const trendPercent = avgRealPercent - prevRealPercent;
        const trend = trendPercent > 0.5 ? 'up' : trendPercent < -0.5 ? 'down' : 'stable';

        // Get restaurant target
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: request.user!.restaurantId! },
            select: { targetCmvPercent: true, alertCmvThreshold: true },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                period,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                totalRevenue,
                totalOrders,
                avgTicket,
                avgTheoreticalPercent,
                avgRealPercent,
                avgWastePercent,
                totalWasteAmount,
                trend,
                trendPercent,
                target: restaurant?.targetCmvPercent || 30,
                alertThreshold: restaurant?.alertCmvThreshold || 35,
                snapshots: snapshots.map((s) => ({
                    id: s.id,
                    date: s.date.toISOString().split('T')[0],
                    revenue: s.revenue,
                    orderCount: s.orderCount,
                    avgTicket: s.avgTicket,
                    theoreticalCogs: s.theoreticalCogs,
                    realCogs: s.realCogs,
                    theoreticalPercent: s.theoreticalPercent,
                    realPercent: s.realPercent,
                    wastePercent: s.wastePercent,
                    wasteAmount: s.wasteAmount,
                })),
            },
        };

        return reply.send(response);
    });

    // Get today's CMV
    fastify.get('/today', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['CMV'],
            summary: 'Get today CMV',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let snapshot = await prisma.cMVSnapshot.findFirst({
            where: {
                restaurantId: request.user!.restaurantId,
                date: today,
            },
        });

        // If no snapshot, calculate from movements
        if (!snapshot) {
            const [revenue, stockOut] = await Promise.all([
                // This would come from integrations in real app
                Promise.resolve(0),
                prisma.stockMovement.aggregate({
                    where: {
                        product: { restaurantId: request.user!.restaurantId },
                        type: { in: ['OUT', 'WASTE', 'PRODUCTION'] },
                        createdAt: { gte: today },
                    },
                    _sum: { totalCost: true },
                    _count: true,
                }),
            ]);

            const realCogs = stockOut._sum.totalCost || 0;
            const realPercent = revenue > 0 ? (realCogs / revenue) * 100 : 0;

            snapshot = {
                id: 'temp',
                restaurantId: request.user!.restaurantId!,
                date: today,
                revenue,
                orderCount: 0,
                avgTicket: 0,
                theoreticalCogs: 0,
                realCogs,
                theoreticalPercent: 0,
                realPercent,
                wastePercent: 0,
                wasteAmount: 0,
                byCategory: null,
                byChannel: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }

        const response: ApiResponse = {
            success: true,
            data: {
                date: snapshot.date.toISOString().split('T')[0],
                revenue: snapshot.revenue,
                orderCount: snapshot.orderCount,
                avgTicket: snapshot.avgTicket,
                theoreticalCogs: snapshot.theoreticalCogs,
                realCogs: snapshot.realCogs,
                theoreticalPercent: snapshot.theoreticalPercent,
                realPercent: snapshot.realPercent,
                wastePercent: snapshot.wastePercent,
                wasteAmount: snapshot.wasteAmount,
            },
        };

        return reply.send(response);
    });

    // Get CMV by category
    fastify.get<{
        Querystring: { startDate?: string; endDate?: string };
    }>('/by-category', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['CMV'],
            summary: 'Get CMV breakdown by category',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const endDate = request.query.endDate ? new Date(request.query.endDate) : new Date();
        const startDate = request.query.startDate
            ? new Date(request.query.startDate)
            : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Get stock movements by category
        const movements = await prisma.stockMovement.groupBy({
            by: ['productId'],
            where: {
                product: { restaurantId: request.user!.restaurantId },
                type: { in: ['OUT', 'PRODUCTION'] },
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _sum: { totalCost: true },
        });

        // Get product categories
        const productIds = movements.map((m) => m.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, categoryId: true, category: { select: { name: true } } },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        // Aggregate by category
        const categoryTotals = new Map<string, { name: string; total: number }>();

        for (const movement of movements) {
            const product = productMap.get(movement.productId);
            const categoryId = product?.categoryId || 'uncategorized';
            const categoryName = product?.category?.name || 'Sem categoria';

            const existing = categoryTotals.get(categoryId) || { name: categoryName, total: 0 };
            existing.total += movement._sum.totalCost || 0;
            categoryTotals.set(categoryId, existing);
        }

        const totalCost = Array.from(categoryTotals.values()).reduce((sum, c) => sum + c.total, 0);

        const categories = Array.from(categoryTotals.entries())
            .map(([id, data]) => ({
                categoryId: id,
                categoryName: data.name,
                cost: data.total,
                percent: totalCost > 0 ? (data.total / totalCost) * 100 : 0,
            }))
            .sort((a, b) => b.cost - a.cost);

        const response: ApiResponse = {
            success: true,
            data: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                totalCost,
                categories,
            },
        };

        return reply.send(response);
    });

    // Create/update daily snapshot (called by cron or integration)
    fastify.post<{
        Body: {
            date: string;
            revenue: number;
            orderCount: number;
            theoreticalCogs?: number;
        };
    }>('/snapshot', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['CMV'],
            summary: 'Create or update daily snapshot',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { date, revenue, orderCount, theoreticalCogs } = request.body;
        const snapshotDate = new Date(date);
        snapshotDate.setHours(0, 0, 0, 0);

        // Calculate real COGS from stock movements
        const nextDay = new Date(snapshotDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const realCogsResult = await prisma.stockMovement.aggregate({
            where: {
                product: { restaurantId: request.user!.restaurantId },
                type: { in: ['OUT', 'WASTE', 'PRODUCTION'] },
                createdAt: {
                    gte: snapshotDate,
                    lt: nextDay,
                },
            },
            _sum: { totalCost: true },
        });

        const realCogs = realCogsResult._sum.totalCost || 0;
        const avgTicket = orderCount > 0 ? revenue / orderCount : 0;
        const theoreticalPercent = revenue > 0 && theoreticalCogs ? (theoreticalCogs / revenue) * 100 : 0;
        const realPercent = revenue > 0 ? (realCogs / revenue) * 100 : 0;
        const wastePercent = realPercent - theoreticalPercent;
        const wasteAmount = realCogs - (theoreticalCogs || 0);

        const snapshot = await prisma.cMVSnapshot.upsert({
            where: {
                restaurantId_date: {
                    restaurantId: request.user!.restaurantId!,
                    date: snapshotDate,
                },
            },
            create: {
                restaurantId: request.user!.restaurantId!,
                date: snapshotDate,
                revenue,
                orderCount,
                avgTicket,
                theoreticalCogs: theoreticalCogs || 0,
                realCogs,
                theoreticalPercent,
                realPercent,
                wastePercent,
                wasteAmount,
            },
            update: {
                revenue,
                orderCount,
                avgTicket,
                theoreticalCogs: theoreticalCogs || undefined,
                realCogs,
                theoreticalPercent,
                realPercent,
                wastePercent,
                wasteAmount,
            },
        });

        // Create alert if CMV is too high
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: request.user!.restaurantId! },
            select: { alertCmvThreshold: true },
        });

        if (realPercent > (restaurant?.alertCmvThreshold || 35)) {
            await prisma.alert.create({
                data: {
                    restaurantId: request.user!.restaurantId!,
                    type: 'CMV_HIGH',
                    severity: realPercent > 40 ? 'CRITICAL' : 'HIGH',
                    title: 'CMV Acima da Meta',
                    message: `O CMV de ${snapshotDate.toLocaleDateString('pt-BR')} foi de ${realPercent.toFixed(1)}%, acima do limite de ${restaurant?.alertCmvThreshold || 35}%.`,
                    data: { date: snapshotDate.toISOString(), realPercent, threshold: restaurant?.alertCmvThreshold || 35 },
                    actionUrl: '/cmv',
                },
            });
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...snapshot,
                date: snapshot.date.toISOString().split('T')[0],
            },
        };

        return reply.send(response);
    });
}
