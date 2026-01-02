
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';

function calculateAverage(numbers: (number | null)[]): number | null {
    // Filter valid numbers:
    // 1. Not null/NaN
    // 2. Positive (> 0) to ignore zeroed data
    // 3. Not outlier (> 240m / 4h)
    const valid = numbers.filter((n): n is number => n !== null && !isNaN(n) && n > 0 && n <= 240);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Schemas
const workTimesQuerySchema = z.object({
    costCenterId: z.string().optional(),
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

    // Default: this month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
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
     * Helper to process orders and calculate times
     */
    const processOrderTimes = (order: any) => {
        const orderDatetime = order.createdAt;
        const readyDatetime = order.readyAt;
        const deliveredDatetime = order.deliveredAt;

        // Find when it went out for delivery
        const outForDeliveryLog = order.statusHistory?.find((h: any) => h.toStatus === 'EM_ENTREGA');
        const outForDeliveryDatetime = outForDeliveryLog ? outForDeliveryLog.createdAt : null;

        const prepTime = readyDatetime && orderDatetime
            ? (new Date(readyDatetime).getTime() - new Date(orderDatetime).getTime()) / 60000
            : null;

        const pickupTime = outForDeliveryDatetime && readyDatetime
            ? (new Date(outForDeliveryDatetime).getTime() - new Date(readyDatetime).getTime()) / 60000
            : null;

        const deliveryTime = deliveredDatetime && outForDeliveryDatetime
            ? (new Date(deliveredDatetime).getTime() - new Date(outForDeliveryDatetime).getTime()) / 60000
            : null;

        const totalTime = deliveredDatetime && orderDatetime
            ? (new Date(deliveredDatetime).getTime() - new Date(orderDatetime).getTime()) / 60000
            : null;

        return {
            ...order,
            orderDatetime, // For compatibility
            readyDatetime,
            outForDeliveryDatetime,
            deliveredDatetime,
            prepTime,
            pickupTime,
            deliveryTime,
            totalTime
        };
    };

    /**
     * GET /work-times/stats
     */
    fastify.get('/stats', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const user = request.user as { costCenterId: string; role: string };

        const where: any = {
            createdAt: { gte: start, lte: end },
            status: 'CONCLUIDO' // Only concluded orders for stats? Or all? Usually stats are for completed workflows.
        };

        // Permission filtering
        if (query.costCenterId && query.costCenterId !== 'all') {
            where.costCenterId = query.costCenterId;
        } else if (user.role !== 'SUPER_ADMIN') {
            where.costCenterId = user.costCenterId;
        }

        const ordersData = await prisma.pdvOrder.findMany({
            where,
            select: {
                createdAt: true,
                readyAt: true,
                deliveredAt: true,
                statusHistory: {
                    where: { toStatus: 'EM_ENTREGA' },
                    select: { createdAt: true, toStatus: true },
                    take: 1
                }
            },
        });

        const orders = ordersData.map(processOrderTimes);

        const stats = {
            totalOrders: orders.length,
            avgPrepTime: calculateAverage(orders.map(o => o.prepTime)),
            avgPickupTime: calculateAverage(orders.map(o => o.pickupTime)),
            avgDeliveryTime: calculateAverage(orders.map(o => o.deliveryTime)),
            avgTotalTime: calculateAverage(orders.map(o => o.totalTime)),
        };

        return { success: true, data: stats };
    });

    /**
     * GET /work-times/orders
     */
    fastify.get('/orders', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const page = parseInt(query.page);
        const limit = parseInt(query.limit);
        const skip = (page - 1) * limit;
        const user = request.user as { costCenterId: string; role: string };

        const where: any = {
            createdAt: { gte: start, lte: end },
        };

        if (query.costCenterId && query.costCenterId !== 'all') {
            where.costCenterId = query.costCenterId;
        } else if (user.role !== 'SUPER_ADMIN') {
            where.costCenterId = user.costCenterId;
        }

        const [ordersData, total] = await Promise.all([
            prisma.pdvOrder.findMany({
                where,
                select: {
                    id: true,
                    code: true, // externalId
                    salesChannel: true, // logisticsProvider
                    createdAt: true, // orderDatetime
                    readyAt: true, // readyDatetime
                    deliveredAt: true, // deliveredDatetime
                    customerName: true,
                    total: true, // orderValue
                    statusHistory: {
                        where: { toStatus: 'EM_ENTREGA' },
                        select: { createdAt: true, toStatus: true },
                        take: 1
                    },
                    costCenter: {
                        select: { id: true, name: true }
                    }
                },
                orderBy: { createdAt: 'desc' }, // Map sortBy if needed, defaulting to createdAt desc
                skip,
                take: limit,
            }),
            prisma.pdvOrder.count({ where }),
        ]);

        const orders = ordersData.map(order => {
            const processed = processOrderTimes(order);
            return {
                ...processed,
                externalId: order.code,
                logisticsProvider: order.salesChannel,
                orderValue: order.total,
            };
        });

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
     * GET /work-times/evolution
     */
    fastify.get('/evolution', async (request) => {
        const query = workTimesQuerySchema.parse(request.query);
        const { start, end } = getDateRange(query.period, query.startDate, query.endDate);
        const user = request.user as { costCenterId: string; role: string };

        const where: any = {
            createdAt: { gte: start, lte: end },
            status: 'CONCLUIDO'
        };

        if (query.costCenterId && query.costCenterId !== 'all') {
            where.costCenterId = query.costCenterId;
        } else if (user.role !== 'SUPER_ADMIN') {
            where.costCenterId = user.costCenterId;
        }

        const ordersData = await prisma.pdvOrder.findMany({
            where,
            select: {
                createdAt: true,
                readyAt: true,
                deliveredAt: true,
                statusHistory: {
                    where: { toStatus: 'EM_ENTREGA' },
                    select: { createdAt: true, toStatus: true },
                    take: 1
                }
            },
            orderBy: { createdAt: 'asc' },
        });

        const orders = ordersData.map(processOrderTimes);

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
            orderCount: day.prepTimes.length,
        }));

        return { success: true, data: evolution };
    });
}
