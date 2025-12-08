import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { calculateAverage } from '../services/time-calculator';

// Schemas
const workTimesQuerySchema = z.object({
    restaurantId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    period: z.enum(['yesterday', 'last7days', 'thisMonth', 'lastMonth', 'custom']).optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
    sortBy: z.enum(['orderDatetime', 'prepTime', 'pickupTime', 'deliveryTime', 'totalTime']).optional().default('orderDatetime'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Helper to calculate date range from period
function getDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: today };
    }

    if (period === 'last7days') {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        return { start, end: now };
    }

    if (period === 'thisMonth') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now };
    }

    if (period === 'lastMonth') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end };
    }

    if (startDate && endDate) {
        return { start: new Date(startDate), end: new Date(endDate) };
    }

    // Default: last 30 days
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return { start, end: now };
}

export async function workTimesRoutes(fastify: FastifyInstance) {
    // Require authentication for all routes
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token inválido ou ausente' } });
            return;
        }
    });

    /**
     * GET /work-times/stats
     * Get aggregated statistics for work times
     */
    fastify.get('/stats', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const user = request.user as { restaurantId: string };

        const where: any = {
            orderDatetime: {
                gte: start,
                lte: end,
            },
        };

        // If specific restaurant selected
        if (query.restaurantId && query.restaurantId !== 'all') {
            where.restaurantId = query.restaurantId;
        } else {
            // Otherwise filter by user's restaurant
            where.restaurantId = user.restaurantId;
        }

        const orders = await prisma.order.findMany({
            where,
            select: {
                prepTime: true,
                pickupTime: true,
                deliveryTime: true,
                totalTime: true,
            },
        });

        const stats = {
            totalOrders: orders.length,
            avgPrepTime: calculateAverage(orders.map(o => o.prepTime)),
            avgPickupTime: calculateAverage(orders.map(o => o.pickupTime)),
            avgDeliveryTime: calculateAverage(orders.map(o => o.deliveryTime)),
            avgTotalTime: calculateAverage(orders.map(o => o.totalTime)),
        };

        return {
            success: true,
            data: stats,
        };
    });

    /**
     * GET /work-times/orders
     * Get paginated list of orders with times
     */
    fastify.get('/orders', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const page = parseInt(query.page);
        const limit = parseInt(query.limit);
        const skip = (page - 1) * limit;
        const user = request.user as { restaurantId: string };

        const where: any = {
            orderDatetime: {
                gte: start,
                lte: end,
            },
        };

        if (query.restaurantId && query.restaurantId !== 'all') {
            where.restaurantId = query.restaurantId;
        } else {
            where.restaurantId = user.restaurantId;
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                select: {
                    id: true,
                    externalId: true,
                    logisticsProvider: true,
                    orderDatetime: true,
                    readyDatetime: true,
                    outForDeliveryDatetime: true,
                    deliveredDatetime: true,
                    prepTime: true,
                    pickupTime: true,
                    deliveryTime: true,
                    totalTime: true,
                    customerName: true,
                    orderValue: true,
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    [query.sortBy]: query.sortOrder,
                },
                skip,
                take: limit,
            }),
            prisma.order.count({ where }),
        ]);

        return {
            success: true,
            data: orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    });

    /**
     * GET /work-times/by-restaurant
     * Get stats grouped by restaurant
     */
    fastify.get('/by-restaurant', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const user = request.user as { restaurantId: string };

        // Get all restaurants accessible to user (for now, just their restaurant)
        const restaurants = await prisma.restaurant.findMany({
            where: { id: user.restaurantId },
            select: { id: true, name: true },
        });

        const restaurantStats = await Promise.all(
            restaurants.map(async (restaurant) => {
                const orders = await prisma.order.findMany({
                    where: {
                        restaurantId: restaurant.id,
                        orderDatetime: {
                            gte: start,
                            lte: end,
                        },
                    },
                    select: {
                        prepTime: true,
                        pickupTime: true,
                        deliveryTime: true,
                        totalTime: true,
                    },
                });

                return {
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name,
                    orderCount: orders.length,
                    avgPrepTime: calculateAverage(orders.map(o => o.prepTime)),
                    avgPickupTime: calculateAverage(orders.map(o => o.pickupTime)),
                    avgDeliveryTime: calculateAverage(orders.map(o => o.deliveryTime)),
                    avgTotalTime: calculateAverage(orders.map(o => o.totalTime)),
                };
            })
        );

        return {
            success: true,
            data: restaurantStats,
        };
    });

    /**
     * GET /work-times/evolution
     * Get daily averages for chart
     */
    fastify.get('/evolution', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const user = request.user as { restaurantId: string };

        const where: any = {
            orderDatetime: {
                gte: start,
                lte: end,
            },
        };

        if (query.restaurantId && query.restaurantId !== 'all') {
            where.restaurantId = query.restaurantId;
        } else {
            where.restaurantId = user.restaurantId;
        }

        const orders = await prisma.order.findMany({
            where,
            select: {
                orderDatetime: true,
                prepTime: true,
                pickupTime: true,
                deliveryTime: true,
                totalTime: true,
            },
            orderBy: {
                orderDatetime: 'asc',
            },
        });

        // Group by date
        const dailyData: Record<string, {
            date: string;
            prepTimes: number[];
            pickupTimes: number[];
            deliveryTimes: number[];
            totalTimes: number[];
        }> = {};

        orders.forEach(order => {
            const dateKey = order.orderDatetime.toISOString().split('T')[0];

            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    prepTimes: [],
                    pickupTimes: [],
                    deliveryTimes: [],
                    totalTimes: [],
                };
            }

            if (order.prepTime !== null) dailyData[dateKey].prepTimes.push(order.prepTime);
            if (order.pickupTime !== null) dailyData[dateKey].pickupTimes.push(order.pickupTime);
            if (order.deliveryTime !== null) dailyData[dateKey].deliveryTimes.push(order.deliveryTime);
            if (order.totalTime !== null) dailyData[dateKey].totalTimes.push(order.totalTime);
        });

        const evolution = Object.values(dailyData).map(day => ({
            date: day.date,
            avgPrepTime: calculateAverage(day.prepTimes),
            avgPickupTime: calculateAverage(day.pickupTimes),
            avgDeliveryTime: calculateAverage(day.deliveryTimes),
            avgTotalTime: calculateAverage(day.totalTimes),
            orderCount: day.prepTimes.length + day.pickupTimes.length,
        }));

        return {
            success: true,
            data: evolution,
        };
    });
}
