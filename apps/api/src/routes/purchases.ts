import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

export async function purchaseRoutes(fastify: FastifyInstance) {
    // Get purchase suggestions
    fastify.get('/suggestions', {
        preHandler: [requireCostCenter],
        schema: { tags: ['Purchases'], summary: 'Get AI purchase suggestions', security: [{ bearerAuth: [] }] },
    }, async (request, reply) => {
        const suggestions = await prisma.purchaseSuggestion.findMany({
            where: {
                costCenterId: request.user!.costCenterId,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                isAccepted: null,
            },
            include: {
                product: {
                    select: { id: true, name: true, sku: true, baseUnit: true, currentStock: true, minStock: true, avgCost: true },
                },
            },
            orderBy: [{ priority: 'desc' }, { estimatedRunoutDate: 'asc' }],
        });

        return reply.send({
            success: true, data: suggestions.map((s) => ({
                ...s, estimatedRunoutDate: s.estimatedRunoutDate?.toISOString(), generatedAt: s.generatedAt.toISOString(),
            }))
        });
    });

    // Generate suggestions
    fastify.post('/suggestions/generate', {
        preHandler: [requireCostCenter],
        schema: { tags: ['Purchases'], summary: 'Generate AI purchase suggestions', security: [{ bearerAuth: [] }] },
    }, async (request, reply) => {
        const products = await prisma.product.findMany({
            where: { costCenterId: request.user!.costCenterId, isActive: true, isRawMaterial: true },
            include: {
                movements: {
                    where: { type: { in: ['OUT', 'PRODUCTION'] }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                    select: { quantity: true },
                },
            },
        });

        await prisma.purchaseSuggestion.deleteMany({ where: { costCenterId: request.user!.costCenterId } });
        const suggestions: any[] = [];

        for (const product of products) {
            const totalConsumption = product.movements.reduce((sum, m) => sum + m.quantity, 0);
            const avgDaily = totalConsumption / 30;
            if (avgDaily === 0) continue;

            const reorderPoint = (avgDaily * product.leadTimeDays) + (avgDaily * 0.2 * product.leadTimeDays);
            if (product.currentStock > reorderPoint) continue;

            const suggestedQty = Math.ceil(avgDaily * 7 - product.currentStock);
            if (suggestedQty <= 0) continue;

            const daysLeft = product.currentStock / avgDaily;
            let priority: any = 'LOW';
            if (daysLeft <= 1) priority = 'URGENT';
            else if (daysLeft <= 3) priority = 'HIGH';
            else if (daysLeft <= 5) priority = 'MEDIUM';

            suggestions.push({
                costCenterId: request.user!.costCenterId, productId: product.id, currentStock: product.currentStock,
                avgDailyConsumption: avgDaily, suggestedQuantity: suggestedQty, suggestedUnit: product.baseUnit,
                reorderPoint, leadTimeDays: product.leadTimeDays, priority, confidence: 0.8,
                estimatedRunoutDate: new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000),
                reasoning: `Consumo: ${avgDaily.toFixed(2)}/dia. Estoque: ${product.currentStock}. Sugiro ${suggestedQty}.`,
            });
        }

        if (suggestions.length > 0) await prisma.purchaseSuggestion.createMany({ data: suggestions });
        return reply.status(201).send({ success: true, data: { generated: suggestions.length } });
    });

    // Accept/reject suggestion
    fastify.patch<{ Params: { id: string }; Body: { accepted: boolean; quantity?: number } }>('/suggestions/:id', {
        preHandler: [requireCostCenter],
    }, async (request, reply) => {
        const suggestion = await prisma.purchaseSuggestion.findFirst({
            where: { id: request.params.id, costCenterId: request.user!.costCenterId },
        });
        if (!suggestion) throw errors.notFound('Suggestion not found');

        await prisma.purchaseSuggestion.update({
            where: { id: request.params.id },
            data: { isAccepted: request.body.accepted, acceptedAt: request.body.accepted ? new Date() : null },
        });
        return reply.send({ success: true, data: { message: 'Updated' } });
    });

    // Get anomalies
    fastify.get('/anomalies', { preHandler: [requireCostCenter] }, async (request, reply) => {
        const anomalies = await prisma.consumptionAnomaly.findMany({
            where: { costCenterId: request.user!.costCenterId, isResolved: false },
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        });
        return reply.send({ success: true, data: anomalies });
    });
}
