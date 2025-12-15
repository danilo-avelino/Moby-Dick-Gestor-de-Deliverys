import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireCostCenter } from '../middleware/auth';
import { PurchaseListService } from '../services/purchase-list.service';
import { errors } from '../middleware/error-handler';
import { PurchaseListTriggerType, PurchaseListStatus } from 'database';

// Schemas
const generateListSchema = z.object({
    description: z.string().optional(),
    notes: z.string().optional()
});

const confirmItemSchema = z.object({
    confirmedQuantity: z.number().min(0)
});

const updateStatusSchema = z.object({
    status: z.enum(['ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'])
});

export async function purchaseListRoutes(fastify: FastifyInstance) {

    // Get all purchase lists
    fastify.get('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Get all purchase lists',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const { status, triggerType, startDate, endDate, page, limit } = request.query as any;

        const result = await PurchaseListService.getPurchaseLists(request.user!.costCenterId, {
            status: status as PurchaseListStatus | undefined,
            triggerType: triggerType as PurchaseListTriggerType | undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20
        });

        return reply.send({ success: true, data: result });
    });

    // Get single purchase list
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Get purchase list details',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const list = await PurchaseListService.getPurchaseListById(
            request.params.id,
            request.user!.costCenterId
        );

        if (!list) {
            throw errors.notFound('Lista de compras não encontrada');
        }

        return reply.send({ success: true, data: list });
    });

    // Generate new purchase list (manual)
    fastify.post('/generate', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Generate new purchase list',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const body = generateListSchema.parse(request.body);

        const list = await PurchaseListService.generatePurchaseList(
            request.user!.costCenterId,
            request.user!.id,
            'MANUAL' as PurchaseListTriggerType,
            body.description,
            body.notes
        );

        if (!list) {
            return reply.status(200).send({
                success: true,
                data: null,
                message: 'Nenhum produto precisa de reposição no momento'
            });
        }

        return reply.status(201).send({ success: true, data: list });
    });

    // Update purchase list status
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Update purchase list status',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const body = updateStatusSchema.parse(request.body);

        const list = await PurchaseListService.updateListStatus(
            request.params.id,
            body.status as PurchaseListStatus
        );

        return reply.send({ success: true, data: list });
    });

    // Delete/cancel purchase list
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Cancel purchase list',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        await PurchaseListService.updateListStatus(request.params.id, 'CANCELADA');
        return reply.send({ success: true, data: { message: 'Lista cancelada' } });
    });

    // Confirm item arrival
    fastify.post<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId/confirm', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Confirm item arrival and update stock',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const body = confirmItemSchema.parse(request.body);

        try {
            const item = await PurchaseListService.confirmItemArrival(
                request.params.itemId,
                body.confirmedQuantity,
                request.user!.id
            );

            return reply.send({ success: true, data: item });
        } catch (error: any) {
            throw errors.badRequest(error.message);
        }
    });

    // Cancel item
    fastify.delete<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Lists'],
            summary: 'Cancel purchase list item',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const item = await PurchaseListService.cancelItem(request.params.itemId);
        return reply.send({ success: true, data: item });
    });
}

// Purchase Config Routes
export async function purchaseConfigRoutes(fastify: FastifyInstance) {

    // Get config
    fastify.get('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Config'],
            summary: 'Get purchase configuration',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const config = await PurchaseListService.getConfig(request.user!.costCenterId);
        return reply.send({ success: true, data: config });
    });

    // Update config
    fastify.put('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Purchase Config'],
            summary: 'Update purchase configuration',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const body = request.body as any;

        const config = await PurchaseListService.updateConfig(
            request.user!.costCenterId,
            {
                triggerPostInventory: body.triggerPostInventory,
                triggerCriticalStock: body.triggerCriticalStock,
                criticalStockPercentage: body.criticalStockPercentage,
                triggerFixedDates: body.triggerFixedDates,
                recurrenceType: body.recurrenceType,
                weekDays: body.weekDays,
                monthDays: body.monthDays
            }
        );

        return reply.send({ success: true, data: config });
    });
}
