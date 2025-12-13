import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const openSessionSchema = z.object({
    openingBalance: z.number().min(0),
    notes: z.string().optional(),
});

const movementSchema = z.object({
    type: z.enum(['SANGRIA', 'SUPRIMENTO']),
    amount: z.number().positive(),
    description: z.string(),
    paymentMethod: z.enum(['DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'VALE_REFEICAO', 'VALE_ALIMENTACAO', 'CORTESIA']).optional(),
});

const closeSessionSchema = z.object({
    closingBalance: z.number().min(0),
    notes: z.string().optional(),
});

export async function cashSessionRoutes(fastify: FastifyInstance) {
    // Get current session
    fastify.get('/current', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'Get current cash session',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const restaurantId = request.user?.restaurantId;

        const session = await prisma.cashSession.findFirst({
            where: {
                restaurantId: restaurantId!,
                status: 'ABERTO',
            },
            include: {
                openedBy: { select: { id: true, firstName: true, lastName: true } },
                movements: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: session ? {
                ...session,
                openedAt: session.openedAt.toISOString(),
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
                movements: session.movements.map(m => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
                })),
            } : null,
        };

        return reply.send(response);
    });

    // Open cash session
    fastify.post('/open', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'Open cash session',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = openSessionSchema.parse(request.body);
        const restaurantId = request.user!.restaurantId!;

        // Check if there's already an open session
        const existingSession = await prisma.cashSession.findFirst({
            where: {
                restaurantId,
                status: 'ABERTO',
            },
        });

        if (existingSession) {
            throw errors.badRequest('There is already an open cash session. Close it before opening a new one.');
        }

        const session = await prisma.cashSession.create({
            data: {
                restaurantId,
                status: 'ABERTO',
                openedByUserId: request.user!.id,
                openingBalance: body.openingBalance,
                expectedBalance: body.openingBalance,
                notes: body.notes,
            },
            include: {
                openedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...session,
                openedAt: session.openedAt.toISOString(),
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Close cash session
    fastify.post('/close', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'Close cash session',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = closeSessionSchema.parse(request.body);
        const restaurantId = request.user!.restaurantId!;

        const session = await prisma.cashSession.findFirst({
            where: {
                restaurantId,
                status: 'ABERTO',
            },
        });

        if (!session) {
            throw errors.badRequest('No open cash session found');
        }

        // Calculate difference
        const difference = body.closingBalance - session.expectedBalance;

        const closedSession = await prisma.cashSession.update({
            where: { id: session.id },
            data: {
                status: 'FECHADO',
                closedByUserId: request.user!.id,
                closedAt: new Date(),
                closingBalance: body.closingBalance,
                difference,
                notes: body.notes,
            },
            include: {
                openedBy: { select: { id: true, firstName: true, lastName: true } },
                closedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...closedSession,
                openedAt: closedSession.openedAt.toISOString(),
                closedAt: closedSession.closedAt?.toISOString(),
                createdAt: closedSession.createdAt.toISOString(),
                updatedAt: closedSession.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Add movement (sangria/suprimento)
    fastify.post('/movements', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'Add cash movement (sangria/suprimento)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = movementSchema.parse(request.body);
        const restaurantId = request.user!.restaurantId!;

        const session = await prisma.cashSession.findFirst({
            where: {
                restaurantId,
                status: 'ABERTO',
            },
        });

        if (!session) {
            throw errors.badRequest('No open cash session. Open a session first.');
        }

        // Create movement and update session
        const [movement] = await prisma.$transaction([
            prisma.cashMovement.create({
                data: {
                    cashSessionId: session.id,
                    type: body.type as any,
                    description: body.description,
                    amount: body.amount,
                    paymentMethod: body.paymentMethod as any,
                    userId: request.user!.id,
                },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                },
            }),
            prisma.cashSession.update({
                where: { id: session.id },
                data: {
                    ...(body.type === 'SANGRIA' ? {
                        totalSangrias: { increment: body.amount },
                        expectedBalance: { decrement: body.amount },
                    } : {
                        totalSuprimentos: { increment: body.amount },
                        expectedBalance: { increment: body.amount },
                    }),
                },
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                ...movement,
                createdAt: movement.createdAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // List movements for current session
    fastify.get('/movements', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'List movements for current session',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const restaurantId = request.user?.restaurantId;

        const session = await prisma.cashSession.findFirst({
            where: {
                restaurantId: restaurantId!,
                status: 'ABERTO',
            },
        });

        if (!session) {
            const response: ApiResponse = {
                success: true,
                data: { movements: [], message: 'No open session' },
            };
            return reply.send(response);
        }

        const movements = await prisma.cashMovement.findMany({
            where: { cashSessionId: session.id },
            include: {
                user: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                movements: movements.map(m => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
                })),
            },
        };

        return reply.send(response);
    });

    // Get session history
    fastify.get<{
        Querystring: {
            page?: string;
            limit?: string;
            startDate?: string;
            endDate?: string;
        };
    }>('/history', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'Get cash session history',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = { status: 'FECHADO' };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        if (request.query.startDate) {
            where.openedAt = { ...where.openedAt, gte: new Date(request.query.startDate) };
        }

        if (request.query.endDate) {
            where.closedAt = { ...where.closedAt, lte: new Date(request.query.endDate) };
        }

        const [sessions, total] = await Promise.all([
            prisma.cashSession.findMany({
                where,
                include: {
                    openedBy: { select: { id: true, firstName: true, lastName: true } },
                    closedBy: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { movements: true } },
                },
                skip,
                take: limit,
                orderBy: { openedAt: 'desc' },
            }),
            prisma.cashSession.count({ where }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                data: sessions.map(s => ({
                    ...s,
                    openedAt: s.openedAt.toISOString(),
                    closedAt: s.closedAt?.toISOString(),
                    createdAt: s.createdAt.toISOString(),
                    updatedAt: s.updatedAt.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1,
                },
            },
        };

        return reply.send(response);
    });

    // Get specific session details
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['PDV - Caixa'],
            summary: 'Get session details',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const session = await prisma.cashSession.findFirst({
            where,
            include: {
                openedBy: { select: { id: true, firstName: true, lastName: true } },
                closedBy: { select: { id: true, firstName: true, lastName: true } },
                movements: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!session) {
            throw errors.notFound('Session not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...session,
                openedAt: session.openedAt.toISOString(),
                closedAt: session.closedAt?.toISOString(),
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
                movements: session.movements.map(m => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
                })),
            },
        };

        return reply.send(response);
    });
}
