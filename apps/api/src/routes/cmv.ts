import { FastifyInstance } from 'fastify';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import type { ApiResponse } from 'types';

export async function cmvRoutes(fastify: FastifyInstance) {
    // Get CMV summary (Dynamic Calculation)
    fastify.get<{
        Querystring: {
            period?: 'daily' | 'weekly' | 'monthly' | 'custom';
            startDate?: string;
            endDate?: string;
        };
    }>('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['CMV'],
            summary: 'Get CMV summary',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { period = 'monthly', startDate: queryStartDate, endDate: queryEndDate } = request.query;
        const costCenterId = request.user!.costCenterId!;

        // Determine date range
        let end = queryEndDate ? new Date(queryEndDate) : new Date();
        let start = queryStartDate ? new Date(queryStartDate) : new Date();

        if (!queryStartDate) {
            if (period === 'daily') start = new Date(end); // Today
            else if (period === 'weekly') {
                start = new Date(end);
                start.setDate(end.getDate() - 7);
            }
            else if (period === 'monthly') {
                start = new Date(end.getFullYear(), end.getMonth(), 1); // Start of month
                end = new Date(end.getFullYear(), end.getMonth() + 1, 0); // End of month
            }
        }

        // Ensure accurate timestamps
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // 1. Calculate Total Cost (Stock OUT)
        const stockOutAgg = await prisma.stockMovement.aggregate({
            where: {
                organizationId: request.user!.organizationId,
                type: 'OUT',
                createdAt: { gte: start, lte: end }
            },
            _sum: { totalCost: true }
        });

        const totalCost = stockOutAgg._sum.totalCost || 0;

        // 2. Calculate Total Revenue (Internal)
        // "Soma dos faturamentos que intersectam o período"
        const revenues = await prisma.revenue.findMany({
            where: {
                costCenterId: costCenterId,
                OR: [
                    { startDate: { lte: end }, endDate: { gte: start } }
                ]
            }
        });

        const totalRevenue = revenues.reduce((sum: number, rev: { totalAmount: number }) => sum + rev.totalAmount, 0);

        // 3. Calculate CMV
        const cmvPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

        // 4. Alerts
        const alerts: string[] = [];
        if (totalRevenue === 0) alerts.push('Sem faturamento registrado para o período.');
        if (totalCost === 0) alerts.push('Sem saídas de estoque no período.');

        return reply.send({
            success: true,
            data: {
                period,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                totalRevenue,
                totalCost,
                cmvPercent,
                summary: {
                    revenue: totalRevenue,
                    cost: totalCost,
                    cmv: cmvPercent
                },
                alerts
            }
        });
    });

    // Get today's CMV (Convenience route)
    fastify.get('/today', {
        preHandler: [requireCostCenter],
    }, async (request, reply) => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        // Cost
        const stockOutAgg = await prisma.stockMovement.aggregate({
            where: {
                organizationId: request.user!.organizationId,
                type: 'OUT',
                createdAt: { gte: start, lte: end }
            },
            _sum: { totalCost: true }
        });
        const totalCost = stockOutAgg._sum.totalCost || 0;

        // Revenue
        const revenues = await prisma.revenue.findMany({
            where: {
                costCenterId: request.user!.costCenterId!,
                startDate: { lte: end },
                endDate: { gte: start }
            }
        });
        const totalRevenue = revenues.reduce((sum: number, rev: { totalAmount: number }) => sum + rev.totalAmount, 0);

        const cmvPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

        return reply.send({
            success: true,
            data: {
                totalRevenue,
                totalCost,
                cmvPercent
            }
        });
    });

    // Get CMV by category
    fastify.get<{
        Querystring: { startDate?: string; endDate?: string };
    }>('/by-category', {
        preHandler: [requireCostCenter],
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
        // Note: Filtering by organizationId for stock movements
        const movements = await prisma.stockMovement.groupBy({
            by: ['productId'],
            where: {
                organizationId: request.user!.organizationId,
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
            existing.total = (existing.total || 0) + (movement._sum.totalCost || 0);
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

        return reply.send({
            success: true,
            data: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                totalCost,
                categories,
            },
        });
    });
}
