import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireCostCenter } from '../middleware/auth';
import { InventoryService } from '../services/inventory.service';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const startInventorySchema = z.object({
    notes: z.string().optional()
});

const updateCountSchema = z.object({
    itemId: z.string(),
    quantity: z.number().min(0)
});

export async function inventoryRoutes(fastify: FastifyInstance) {
    // Start Inventory
    fastify.post('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Start new inventory session',
            security: [{ bearerAuth: [] }],
        }
    }, async (request, reply) => {
        const body = startInventorySchema.parse(request.body);
        const { costCenterId, organizationId, id: userId } = request.user!;

        if (!costCenterId) {
            throw errors.badRequest('É necessário selecionar um Centro de Custo para iniciar o inventário.');
        }

        try {
            const session = await InventoryService.startInventory(costCenterId, organizationId!, userId, body.notes);
            return reply.send({ success: true, data: session });
        } catch (error: any) {
            request.log.error(error);
            throw errors.conflict(error.message);
        }
    });

    // Get Active Inventory
    fastify.get('/active', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Get active inventory session',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const { costCenterId } = request.user!;
        const session = await InventoryService.getActiveInventory(costCenterId!);

        return reply.send({ success: true, data: session });
    });

    // Get History
    fastify.get('/history', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Get inventory history',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const { costCenterId } = request.user!;
        const history = await InventoryService.getHistory(costCenterId!);

        return reply.send({ success: true, data: history });
    });

    // Get Inventory Details (Items)
    fastify.get('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Get inventory details',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { categoryId } = request.query as { categoryId?: string };

        const items = await InventoryService.getInventoryItems(id, categoryId);

        return reply.send({ success: true, data: items });
    });

    // Update Item Count
    fastify.post('/:id/count', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Update item count',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const body = updateCountSchema.parse(request.body);

        const updatedItem = await InventoryService.updateItemCount(body.itemId, body.quantity);

        return reply.send({ success: true, data: updatedItem });
    });

    // Finish Inventory
    fastify.post('/:id/finish', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Finish inventory session',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { id: userId } = request.user!;

        try {
            const result = await InventoryService.finishInventory(id, userId);
            return reply.send({ success: true, data: result });
        } catch (error: any) {
            console.error('Error finishing inventory:', error);
            throw errors.badRequest(error.message);
        }
    });
    // Generate Share Token
    fastify.post('/:id/share', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Inventory'],
            summary: 'Generate share token',
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const token = await InventoryService.getShareToken(id);
        return reply.send({ success: true, data: { token } });
    });
}

// Public Routes (No Auth Required)
export async function inventoryPublicRoutes(fastify: FastifyInstance) {
    // Get Public Inventory Items
    fastify.get('/:token/items', {
        schema: {
            tags: ['Inventory Public'],
            summary: 'Get public inventory items'
        }
    }, async (request, reply) => {
        const { token } = request.params as { token: string };
        const { categoryId } = request.query as { categoryId?: string };

        try {
            const session = await InventoryService.getSessionByToken(token);
            const items = await InventoryService.getInventoryItems(session.id, categoryId);
            return reply.send({ success: true, data: { session, items } });
        } catch (error: any) {
            throw errors.forbidden(error.message);
        }
    });

    // Public Update Count
    fastify.post('/:token/count', {
        schema: {
            tags: ['Inventory Public'],
            summary: 'Update item count public'
        }
    }, async (request, reply) => {
        const { token } = request.params as { token: string };
        const body = z.object({
            itemId: z.string(),
            quantity: z.number().min(0)
        }).parse(request.body);

        try {
            // Validate token first
            await InventoryService.getSessionByToken(token);
            const updatedItem = await InventoryService.updateItemCount(body.itemId, body.quantity);
            return reply.send({ success: true, data: updatedItem });
        } catch (error: any) {
            throw errors.forbidden(error.message);
        }
    });
}
