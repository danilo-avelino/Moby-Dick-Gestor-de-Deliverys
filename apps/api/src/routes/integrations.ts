import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter, requireRole } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { UserRole, type ApiResponse } from 'types';
import { integrationManager } from '../services/integrations/integration-manager';
import { integrationInboxService } from '../services/integrations/integration-inbox.service';
import { foodyWorkTimesService } from '../services/integrations/foody-work-times.service';

// All platforms - Sales + Logistics
const PLATFORMS = {
    // Sales platforms
    IFOOD: { type: 'sales', name: 'iFood', logo: '🍔', category: 'vendas', fields: ['clientId', 'clientSecret'] },
    '99FOOD': { type: 'sales', name: '99Food', logo: '🛵', category: 'vendas', fields: ['apiToken'] },
    NEEMO: { type: 'sales', name: 'Neemo', logo: '🍕', category: 'vendas', fields: ['apiToken'] },
    CARDAPIO_WEB: { type: 'sales', name: 'Cardápio Web', logo: '📱', category: 'vendas', fields: ['apiToken'] },
    ANOTAAI: { type: 'sales', name: 'AnotaAi', logo: '📝', category: 'vendas', fields: ['apiToken'] },
    CONSUMER: { type: 'sales', name: 'Consumer', logo: '🛒', category: 'vendas', fields: ['apiToken'] },
    SAIPOS: { type: 'sales', name: 'Saipos', logo: '💳', category: 'vendas', fields: ['clientId', 'clientSecret'] },
    // Logistics platforms
    FOODY: { type: 'logistics', name: 'Foody Delivery', logo: '🚚', category: 'logistica', fields: ['apiToken'] },
    AGILIZONE: { type: 'logistics', name: 'Agilizone', logo: '⚡', category: 'logistica', fields: ['merchantId', 'clientId', 'clientSecret'] },
    SAIPOS_LOGISTICS: { type: 'logistics', name: 'Saipos Logística', logo: '📦', category: 'logistica', fields: ['clientId', 'clientSecret'] },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

const connectIntegrationSchema = z.object({
    platform: z.enum(Object.keys(PLATFORMS) as [PlatformKey, ...PlatformKey[]]),
    name: z.string().min(2),
    subRestaurantId: z.string().optional(), // For separate operation mode
    credentials: z.record(z.string()).optional(),
    syncFrequencyMinutes: z.number().min(5).max(1440).default(15),
});

const updateCredentialsSchema = z.object({
    credentials: z.record(z.string()),
});

export async function integrationRoutes(fastify: FastifyInstance) {
    // List integrations (optionally filter by subRestaurantId)
    fastify.get<{ Querystring: { subRestaurantId?: string } }>('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'List integrations',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { subRestaurantId } = request.query;

        const integrations = await prisma.integration.findMany({
            where: {
                costCenterId: request.user!.costCenterId!,
                ...(subRestaurantId && { metadata: { path: ['subRestaurantId'], equals: subRestaurantId } }),
            },
            select: {
                id: true,
                platform: true,
                name: true,
                status: true,
                syncFrequencyMinutes: true,
                lastSyncAt: true,
                nextSyncAt: true,
                externalId: true,
                metadata: true,
                createdAt: true,
                _count: { select: { syncLogs: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const response: ApiResponse = {
            success: true,
            data: integrations.map((i) => ({
                ...i,
                platformInfo: PLATFORMS[i.platform as PlatformKey] || null,
                lastSyncAt: i.lastSyncAt?.toISOString(),
                nextSyncAt: i.nextSyncAt?.toISOString(),
                createdAt: i.createdAt.toISOString(),
                totalSyncs: i._count.syncLogs,
            })),
        };

        return reply.send(response);
    });

    // Get available platforms
    fastify.get('/platforms', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Get available platforms',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const platforms = Object.entries(PLATFORMS).map(([id, info]) => ({
            id,
            ...info,
            description: info.type === 'sales'
                ? `Receba pedidos via ${info.name}`
                : `Gerencie entregas com ${info.name}`,
        }));

        // Check which are already connected
        const connected = await prisma.integration.findMany({
            where: { costCenterId: request.user!.costCenterId! },
            select: { platform: true, metadata: true },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                sales: platforms.filter(p => p.type === 'sales').map(p => ({
                    ...p,
                    isConnected: connected.some(c => c.platform === p.id),
                })),
                logistics: platforms.filter(p => p.type === 'logistics').map(p => ({
                    ...p,
                    isConnected: connected.some(c => c.platform === p.id),
                })),
            },
        };

        return reply.send(response);
    });

    // --- Inbox & Observability ---

    fastify.get<{ Querystring: { integrationId?: string; status?: string; startDate?: string; endDate?: string; page?: string; limit?: string } }>('/inbox', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Get integration inbox items',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { integrationId, status, startDate, endDate, page, limit } = request.query;
        if (integrationId) {
            const integration = await prisma.integration.findFirst({
                where: { id: integrationId, costCenterId: request.user!.costCenterId! }
            });
            if (!integration) throw errors.forbidden('Access denied');
        }
        const result = await integrationInboxService.listItems({
            integrationId,
            status: status as any,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page: page ? parseInt(page) : 1,
            pageSize: limit ? parseInt(limit) : 50
        });
        return reply.send({ success: true, data: result });
    });

    fastify.post<{ Params: { itemId: string } }>('/inbox/:itemId/reprocess', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Reprocess inbox item',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const item = await prisma.integrationInbox.findUnique({
            where: { id: request.params.itemId },
            include: { integration: true }
        });
        if (!item || item.integration.costCenterId !== request.user!.costCenterId!) {
            throw errors.notFound('Item not found');
        }
        await integrationManager.reprocessInboxItem(request.params.itemId);
        return reply.send({ success: true, message: 'Item reprocessed' });
    });

    // Get integration details
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Get integration details',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
            include: {
                syncLogs: {
                    take: 10,
                    orderBy: { startedAt: 'desc' },
                },
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        // Don't expose credentials
        const { credentials, accessToken, refreshToken, webhookSecret, ...safe } = integration;

        const response: ApiResponse = {
            success: true,
            data: {
                ...safe,
                platformInfo: PLATFORMS[integration.platform as PlatformKey] || null,
                hasCredentials: !!credentials && Object.keys(credentials as object).length > 0,
                hasAccessToken: !!accessToken,
                lastSyncAt: safe.lastSyncAt?.toISOString(),
                nextSyncAt: safe.nextSyncAt?.toISOString(),
                tokenExpiresAt: safe.tokenExpiresAt?.toISOString(),
                createdAt: safe.createdAt.toISOString(),
                updatedAt: safe.updatedAt.toISOString(),
                syncLogs: safe.syncLogs.map((log) => ({
                    ...log,
                    startedAt: log.startedAt.toISOString(),
                    completedAt: log.completedAt?.toISOString(),
                })),
            },
        };

        return reply.send(response);
    });

    // Connect new integration
    fastify.post('/', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Connect integration',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = connectIntegrationSchema.parse(request.body);
        const platformInfo = PLATFORMS[body.platform];

        // Check if platform already connected for this sub-restaurant
        const existing = await prisma.integration.findFirst({
            where: {
                costCenterId: request.user!.costCenterId!,
                platform: body.platform,
                ...(body.subRestaurantId && {
                    metadata: { path: ['subRestaurantId'], equals: body.subRestaurantId }
                }),
            },
        });

        if (existing) {
            throw errors.conflict('Integration with this platform already exists');
        }

        const integration = await prisma.integration.create({
            data: {
                costCenterId: request.user!.costCenterId!,
                platform: body.platform,
                name: body.name,
                status: body.credentials ? 'CONFIGURED' : 'STOPPED',
                credentials: body.credentials || {},
                syncFrequencyMinutes: body.syncFrequencyMinutes,
                metadata: body.subRestaurantId ? { subRestaurantId: body.subRestaurantId } : {},
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: integration.id,
                platform: integration.platform,
                name: integration.name,
                status: integration.status,
                platformInfo,
                createdAt: integration.createdAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update credentials
    fastify.put<{ Params: { id: string } }>('/:id/credentials', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Update integration credentials',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = updateCredentialsSchema.parse(request.body);

        const existing = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!existing) {
            throw errors.notFound('Integration not found');
        }

        // Update credentials and set status to pending
        const integration = await prisma.integration.update({
            where: { id: request.params.id },
            data: {
                credentials: body.credentials,
                status: 'CONFIGURED',
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: integration.id,
                status: integration.status,
                message: 'Credentials updated. Testing connection...',
            },
        };

        return reply.send(response);
    });

    // Test connection
    fastify.post<{ Params: { id: string } }>('/:id/test', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Test integration connection',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        // Try to test connection using IntegrationManager
        let success = false;
        let errorMessage = '';

        try {
            // Add to manager temporarily for testing
            const added = await integrationManager.addIntegration({
                id: integration.id,
                platform: integration.platform,
                type: (PLATFORMS[integration.platform as PlatformKey]?.type || 'sales') as 'sales' | 'logistics',
                credentials: integration.credentials as any,
                syncInterval: integration.syncFrequencyMinutes,
                organizationId: integration.organizationId || undefined,
                costCenterId: integration.costCenterId,
            });

            if (added) {
                success = await integrationManager.testConnection(integration.id);
                if (!success) {
                    integrationManager.removeIntegration(integration.id);
                }
            }
        } catch (error: any) {
            errorMessage = error.message || 'Connection test failed';
        }

        // Update status based on result
        await prisma.integration.update({
            where: { id: integration.id },
            data: {
                status: success ? 'CONNECTED' : 'DEGRADED',
                lastSyncAt: success ? new Date() : undefined,
            },
        });

        const response: ApiResponse = {
            success,
            data: {
                connected: success,
                message: success ? 'Connection successful!' : errorMessage || 'Connection failed',
            },
        };

        return reply.send(response);
    });

    // Activate/Deactivate integration
    fastify.post<{ Params: { id: string } }>('/:id/toggle', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Toggle integration status',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        const newStatus = integration.status === 'CONNECTED' ? 'STOPPED' : 'CONNECTED';

        // If activating, add to manager; if deactivating, remove
        if (newStatus === 'CONNECTED') {
            await integrationManager.addIntegration({
                id: integration.id,
                platform: integration.platform,
                type: (PLATFORMS[integration.platform as PlatformKey]?.type || 'sales') as 'sales' | 'logistics',
                credentials: integration.credentials as any,
                syncInterval: integration.syncFrequencyMinutes,
                organizationId: integration.organizationId || undefined,
                costCenterId: integration.costCenterId,
            });
        } else {
            integrationManager.removeIntegration(integration.id);
        }

        await prisma.integration.update({
            where: { id: integration.id },
            data: { status: newStatus as any },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                status: newStatus,
                message: newStatus === 'CONNECTED' ? 'Integration activated' : 'Integration deactivated',
            },
        };

        return reply.send(response);
    });

    // Trigger manual sync
    fastify.post<{ Params: { id: string } }>('/:id/sync', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Trigger manual sync',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        if (integration.status !== 'CONNECTED') {
            throw errors.badRequest('Integration is not active');
        }

        // Create sync log
        const syncLog = await prisma.syncLog.create({
            data: {
                integrationId: integration.id,
                syncType: 'MANUAL',
                status: 'RUNNING',
            },
        });

        // Update integration status
        await prisma.integration.update({
            where: { id: integration.id },
            data: { status: 'INGESTING' },
        });

        // Trigger sync in background
        integrationManager.manualSync(integration.id)
            .then(async (count) => {
                await prisma.syncLog.update({
                    where: { id: syncLog.id },
                    data: {
                        status: 'SUCCESS',
                        completedAt: new Date(),
                        recordsProcessed: count,
                    },
                });

                await prisma.integration.update({
                    where: { id: integration.id },
                    data: {
                        status: 'CONNECTED',
                        lastSyncAt: new Date(),
                        nextSyncAt: new Date(Date.now() + integration.syncFrequencyMinutes * 60 * 1000),
                    },
                });
            })
            .catch(async (error) => {
                await prisma.syncLog.update({
                    where: { id: syncLog.id },
                    data: {
                        status: 'FAILED',
                        completedAt: new Date(),
                        errors: { message: error.message },
                    },
                });

                await prisma.integration.update({
                    where: { id: integration.id },
                    data: { status: 'DEGRADED' },
                });
            });

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'Sync started',
                syncLogId: syncLog.id,
            },
        };

        return reply.send(response);
    });

    // Get sync logs
    fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/:id/logs', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Get sync logs',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        const limit = parseInt(request.query.limit || '20', 10);

        const logs = await prisma.syncLog.findMany({
            where: { integrationId: integration.id },
            take: limit,
            orderBy: { startedAt: 'desc' },
        });

        const response: ApiResponse = {
            success: true,
            data: logs.map((log) => ({
                ...log,
                startedAt: log.startedAt.toISOString(),
                completedAt: log.completedAt?.toISOString(),
            })),
        };

        return reply.send(response);
    });

    // Disconnect integration
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Disconnect integration',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        // Remove from manager
        integrationManager.removeIntegration(integration.id);

        await prisma.integration.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Integration disconnected' },
        };

        return reply.send(response);
    });

    // Trigger Foody Daily Ingestion (Manual Job)
    fastify.post('/foody/ingest-daily', {
        preHandler: [requireCostCenter, requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.DIRETOR)],
        schema: {
            tags: ['Integrations'],
            summary: 'Trigger Foody Daily Ingestion',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const bodySchema = z.object({
            date: z.string().optional(), // YYYY-MM-DD
        });
        const { date } = bodySchema.parse(request.body);
        const costCenterId = request.user!.costCenterId!;

        try {
            const stats = await foodyWorkTimesService.ingestDailyOrders(costCenterId, date);
            return reply.send({ success: true, data: stats });
        } catch (error: any) {
            throw errors.badRequest(error.message || 'Ingestion failed');
        }
    });

    // --- Order Operations (for sales integrations) ---

    // Fetch orders from integration
    fastify.get<{ Params: { id: string } }>('/:id/orders', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Fetch orders from integration',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        try {
            const orders = await integrationManager.fetchOrders(integration.id);

            const response: ApiResponse = {
                success: true,
                data: orders,
            };

            return reply.send(response);
        } catch (error: any) {
            throw errors.badRequest(error.message || 'Failed to fetch orders');
        }
    });

    // --- Delivery Operations (for logistics integrations) ---

    // Get delivery quote
    fastify.post<{ Params: { id: string } }>('/:id/delivery/quote', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Get delivery quote',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        try {
            const quote = await integrationManager.getDeliveryQuote(integration.id, request.body as any);

            const response: ApiResponse = {
                success: true,
                data: quote,
            };

            return reply.send(response);
        } catch (error: any) {
            throw errors.badRequest(error.message || 'Failed to get quote');
        }
    });

    // Request delivery
    fastify.post<{ Params: { id: string } }>('/:id/delivery/request', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Request delivery',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        try {
            const deliveryId = await integrationManager.requestDelivery(integration.id, request.body as any);

            const response: ApiResponse = {
                success: true,
                data: { deliveryId },
            };

            return reply.send(response);
        } catch (error: any) {
            throw errors.badRequest(error.message || 'Failed to request delivery');
        }
    });

    // Get delivery tracking
    fastify.get<{ Params: { id: string; deliveryId: string } }>('/:id/delivery/:deliveryId/tracking', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Integrations'],
            summary: 'Get delivery tracking',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const integration = await prisma.integration.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId!,
            },
        });

        if (!integration) {
            throw errors.notFound('Integration not found');
        }

        try {
            const tracking = await integrationManager.getDeliveryTracking(integration.id, request.params.deliveryId);

            const response: ApiResponse = {
                success: true,
                data: tracking,
            };

            return reply.send(response);
        } catch (error: any) {
            throw errors.badRequest(error.message || 'Failed to get tracking');
        }
    });
}
