import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const createTableSchema = z.object({
    identifier: z.string().min(1),
    capacity: z.number().int().min(1).default(4),
});

const updateTableSchema = z.object({
    identifier: z.string().min(1).optional(),
    capacity: z.number().int().min(1).optional(),
    status: z.enum(['LIVRE', 'OCUPADA', 'RESERVADA']).optional(),
    isActive: z.boolean().optional(),
});

export async function tablesRoutes(fastify: FastifyInstance) {
    // List tables
    fastify.get<{
        Querystring: {
            status?: string;
            includeInactive?: string;
        };
    }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Mesas'],
            summary: 'List tables',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = {};
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        if (request.query.status) {
            where.status = request.query.status;
        }

        if (request.query.includeInactive !== 'true') {
            where.isActive = true;
        }

        const tables = await prisma.restaurantTable.findMany({
            where,
            include: {
                orders: {
                    where: { status: { notIn: ['CONCLUIDO', 'CANCELADO'] } },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        code: true,
                        total: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { identifier: 'asc' },
        });

        const response: ApiResponse = {
            success: true,
            data: tables.map(t => ({
                ...t,
                currentOrder: t.orders[0] || null,
                orders: undefined,
                createdAt: t.createdAt.toISOString(),
                updatedAt: t.updatedAt.toISOString(),
            })),
        };

        return reply.send(response);
    });

    // Get table by ID
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Mesas'],
            summary: 'Get table details',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const table = await prisma.restaurantTable.findFirst({
            where,
            include: {
                orders: {
                    where: { status: { notIn: ['CONCLUIDO', 'CANCELADO'] } },
                    include: {
                        items: true,
                        payments: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!table) {
            throw errors.notFound('Table not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...table,
                createdAt: table.createdAt.toISOString(),
                updatedAt: table.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Create table
    fastify.post('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Mesas'],
            summary: 'Create table',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createTableSchema.parse(request.body);
        const restaurantId = request.user!.restaurantId!;

        // Check if identifier already exists
        const existing = await prisma.restaurantTable.findFirst({
            where: {
                restaurantId,
                identifier: body.identifier,
            },
        });

        if (existing) {
            throw errors.badRequest(`Table "${body.identifier}" already exists`);
        }

        const table = await prisma.restaurantTable.create({
            data: {
                restaurantId,
                identifier: body.identifier,
                capacity: body.capacity,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...table,
                createdAt: table.createdAt.toISOString(),
                updatedAt: table.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update table
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Mesas'],
            summary: 'Update table',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = updateTableSchema.parse(request.body);

        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const existing = await prisma.restaurantTable.findFirst({ where });
        if (!existing) {
            throw errors.notFound('Table not found');
        }

        // If changing identifier, check uniqueness
        if (body.identifier && body.identifier !== existing.identifier) {
            const duplicate = await prisma.restaurantTable.findFirst({
                where: {
                    restaurantId: existing.restaurantId,
                    identifier: body.identifier,
                    id: { not: existing.id },
                },
            });

            if (duplicate) {
                throw errors.badRequest(`Table "${body.identifier}" already exists`);
            }
        }

        const table = await prisma.restaurantTable.update({
            where: { id: existing.id },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...table,
                createdAt: table.createdAt.toISOString(),
                updatedAt: table.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Delete table
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Mesas'],
            summary: 'Delete table (soft delete)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const existing = await prisma.restaurantTable.findFirst({ where });
        if (!existing) {
            throw errors.notFound('Table not found');
        }

        // Check if table has active orders
        if (existing.status === 'OCUPADA') {
            throw errors.badRequest('Cannot delete table with active orders');
        }

        await prisma.restaurantTable.update({
            where: { id: existing.id },
            data: { isActive: false },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Table deleted' },
        };

        return reply.send(response);
    });

    // Bulk create tables
    fastify.post('/bulk', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Mesas'],
            summary: 'Bulk create tables',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const schema = z.object({
            prefix: z.string().default('Mesa'),
            startNumber: z.number().int().min(1).default(1),
            count: z.number().int().min(1).max(50),
            capacity: z.number().int().min(1).default(4),
        });

        const body = schema.parse(request.body);
        const restaurantId = request.user!.restaurantId!;

        const tables = [];
        for (let i = 0; i < body.count; i++) {
            const identifier = `${body.prefix} ${body.startNumber + i}`;
            tables.push({
                restaurantId,
                identifier,
                capacity: body.capacity,
            });
        }

        // Filter out existing tables
        const existing = await prisma.restaurantTable.findMany({
            where: {
                restaurantId,
                identifier: { in: tables.map(t => t.identifier) },
            },
            select: { identifier: true },
        });

        const existingIds = new Set(existing.map(e => e.identifier));
        const newTables = tables.filter(t => !existingIds.has(t.identifier));

        if (newTables.length === 0) {
            throw errors.badRequest('All specified tables already exist');
        }

        await prisma.restaurantTable.createMany({
            data: newTables,
        });

        const response: ApiResponse = {
            success: true,
            data: {
                message: `Created ${newTables.length} tables`,
                created: newTables.map(t => t.identifier),
                skipped: tables.length - newTables.length,
            },
        };

        return reply.status(201).send(response);
    });
}
