import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

export async function alertRoutes(fastify: FastifyInstance) {
    // List alerts
    fastify.get<{
        Querystring: {
            page?: string;
            limit?: string;
            isRead?: string;
            type?: string;
            severity?: string;
        };
    }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'List alerts',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = {
            restaurantId: request.user!.restaurantId,
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        };

        if (request.query.isRead !== undefined) {
            where.isRead = request.query.isRead === 'true';
        }

        if (request.query.type) {
            where.type = request.query.type;
        }

        if (request.query.severity) {
            where.severity = request.query.severity;
        }

        const [alerts, total, unreadCount] = await Promise.all([
            prisma.alert.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.alert.count({ where }),
            prisma.alert.count({
                where: {
                    ...where,
                    isRead: false,
                },
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                data: alerts.map((a) => ({
                    ...a,
                    createdAt: a.createdAt.toISOString(),
                    expiresAt: a.expiresAt?.toISOString(),
                    readAt: a.readAt?.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1,
                },
                unreadCount,
            },
        };

        return reply.send(response);
    });

    // Get unread count
    fastify.get('/unread-count', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Get unread alerts count',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const [total, critical] = await Promise.all([
            prisma.alert.count({
                where: {
                    restaurantId: request.user!.restaurantId,
                    isRead: false,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
            }),
            prisma.alert.count({
                where: {
                    restaurantId: request.user!.restaurantId,
                    isRead: false,
                    severity: 'CRITICAL',
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: { total, critical },
        };

        return reply.send(response);
    });

    // Mark alert as read
    fastify.patch<{ Params: { id: string } }>('/:id/read', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Mark alert as read',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const alert = await prisma.alert.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!alert) {
            throw errors.notFound('Alert not found');
        }

        await prisma.alert.update({
            where: { id: request.params.id },
            data: {
                isRead: true,
                readAt: new Date(),
                readById: request.user!.id,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Alert marked as read' },
        };

        return reply.send(response);
    });

    // Mark all as read
    fastify.post('/mark-all-read', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Mark all alerts as read',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const result = await prisma.alert.updateMany({
            where: {
                restaurantId: request.user!.restaurantId,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
                readById: request.user!.id,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: `${result.count} alerts marked as read` },
        };

        return reply.send(response);
    });

    // Delete alert
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Delete alert',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const alert = await prisma.alert.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!alert) {
            throw errors.notFound('Alert not found');
        }

        await prisma.alert.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Alert deleted' },
        };

        return reply.send(response);
    });

    // List alert rules
    fastify.get('/rules', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'List alert rules',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const rules = await prisma.alertRule.findMany({
            where: { restaurantId: request.user!.restaurantId },
            orderBy: { type: 'asc' },
        });

        const response: ApiResponse = {
            success: true,
            data: rules,
        };

        return reply.send(response);
    });

    // Create/update alert rule
    fastify.post<{
        Body: {
            type: string;
            name: string;
            conditions: Record<string, any>;
            notificationChannels: string[];
            isActive?: boolean;
        };
    }>('/rules', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Create alert rule',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { type, name, conditions, notificationChannels, isActive = true } = request.body;

        const rule = await prisma.alertRule.create({
            data: {
                restaurantId: request.user!.restaurantId!,
                type: type as any,
                name,
                conditions,
                notificationChannels: notificationChannels as any,
                isActive,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: rule,
        };

        return reply.status(201).send(response);
    });

    // Update alert rule
    fastify.patch<{ Params: { id: string } }>('/rules/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Update alert rule',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = request.body as any;

        const existing = await prisma.alertRule.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!existing) {
            throw errors.notFound('Alert rule not found');
        }

        const rule = await prisma.alertRule.update({
            where: { id: request.params.id },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: rule,
        };

        return reply.send(response);
    });

    // Delete alert rule
    fastify.delete<{ Params: { id: string } }>('/rules/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Alerts'],
            summary: 'Delete alert rule',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const existing = await prisma.alertRule.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!existing) {
            throw errors.notFound('Alert rule not found');
        }

        await prisma.alertRule.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Alert rule deleted' },
        };

        return reply.send(response);
    });
}
