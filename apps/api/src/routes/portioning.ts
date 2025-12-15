import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

export async function portioningRoutes(fastify: FastifyInstance) {
    // List portioning processes
    fastify.get('/processes', {
        preHandler: [requireCostCenter],
        schema: { tags: ['Portioning'], summary: 'List portioning processes', security: [{ bearerAuth: [] }] },
    }, async (request, reply) => {
        const processes = await prisma.portioningProcess.findMany({
            where: { restaurantId: request.user!.costCenterId },
            include: {
                rawProduct: { select: { id: true, name: true, baseUnit: true } },
                outputProduct: { select: { id: true, name: true, baseUnit: true } },
                _count: { select: { batches: true } },
            },
            orderBy: { name: 'asc' },
        });
        return reply.send({ success: true, data: processes });
    });

    // Create process
    fastify.post<{ Body: { name: string; rawProductId: string; outputProductId?: string; yieldPercent: number } }>('/processes', {
        preHandler: [requireCostCenter],
    }, async (request, reply) => {
        const { name, rawProductId, outputProductId, yieldPercent } = request.body;
        const process = await prisma.portioningProcess.create({
            data: {
                restaurantId: request.user!.costCenterId!,
                name, rawProductId, outputProductId,
                yieldPercent, wastePercent: 100 - yieldPercent,
            },
        });
        return reply.status(201).send({ success: true, data: process });
    });

    // Record batch
    fastify.post<{ Body: { processId: string; rawQuantity: number; rawUnit: string; outputQuantity: number } }>('/batches', {
        preHandler: [requireCostCenter],
    }, async (request, reply) => {
        const { processId, rawQuantity, rawUnit, outputQuantity } = request.body;

        const process = await prisma.portioningProcess.findFirst({
            where: { id: processId, restaurantId: request.user!.costCenterId },
            include: { rawProduct: true },
        });
        if (!process) throw errors.notFound('Process not found');

        const rawCost = rawQuantity * process.rawProduct.avgCost;
        const outputCostPerUnit = rawCost / outputQuantity;
        const actualYield = (outputQuantity / rawQuantity) * 100;

        const batch = await prisma.portioningBatch.create({
            data: {
                processId, rawQuantity, rawUnit, rawCost,
                outputQuantity, outputUnit: rawUnit, outputCostPerUnit,
                actualYieldPercent: actualYield, actualWastePercent: 100 - actualYield,
                processedById: request.user!.id,
            },
        });

        // Update stock - remove raw, add output
        await prisma.product.update({
            where: { id: process.rawProductId },
            data: { currentStock: { decrement: rawQuantity } },
        });

        if (process.outputProductId) {
            await prisma.product.update({
                where: { id: process.outputProductId },
                data: { currentStock: { increment: outputQuantity }, avgCost: outputCostPerUnit },
            });
        }

        return reply.status(201).send({ success: true, data: { ...batch, outputCostPerUnit } });
    });

    // Get batches history
    fastify.get<{ Params: { processId: string } }>('/processes/:processId/batches', {
        preHandler: [requireCostCenter],
    }, async (request, reply) => {
        const batches = await prisma.portioningBatch.findMany({
            where: { processId: request.params.processId },
            include: { processedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { processedAt: 'desc' },
            take: 50,
        });
        return reply.send({ success: true, data: batches });
    });
}
