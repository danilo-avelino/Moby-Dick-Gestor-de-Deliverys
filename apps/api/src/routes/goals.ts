import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const createGoalSchema = z.object({
    userId: z.string().optional(),
    teamId: z.string().optional(),
    type: z.enum(['REVENUE', 'ORDER_COUNT', 'AVG_TICKET', 'CMV_PERCENT', 'ITEMS_SOLD', 'SPECIFIC_PRODUCT', 'WASTE_REDUCTION']),
    name: z.string().min(2),
    description: z.string().optional(),
    targetValue: z.number().positive(),
    period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM']),
    periodStart: z.string(),
    periodEnd: z.string(),
    rewardType: z.string().optional(),
    rewardValue: z.string().optional(),
    rewardPoints: z.number().min(0).default(0),
});

export async function goalRoutes(fastify: FastifyInstance) {
    // List goals
    fastify.get<{
        Querystring: {
            userId?: string;
            isActive?: string;
            period?: string;
        };
    }>('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'List goals',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = {
            costCenterId: request.user!.costCenterId,
        };

        if (request.query.userId) {
            where.userId = request.query.userId;
        }

        if (request.query.isActive !== undefined) {
            where.isActive = request.query.isActive === 'true';
        }

        if (request.query.period) {
            where.period = request.query.period;
        }

        const goals = await prisma.goal.findMany({
            where,
            include: {
                user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
            orderBy: [{ isActive: 'desc' }, { periodEnd: 'asc' }],
        });

        const goalsWithProgress = goals.map((g) => ({
            ...g,
            progressPercent: (g.currentValue / g.targetValue) * 100,
            periodStart: g.periodStart.toISOString(),
            periodEnd: g.periodEnd.toISOString(),
            achievedAt: g.achievedAt?.toISOString(),
            createdAt: g.createdAt.toISOString(),
            updatedAt: g.updatedAt.toISOString(),
        }));

        const response: ApiResponse = {
            success: true,
            data: goalsWithProgress,
        };

        return reply.send(response);
    });

    // Get my goals (for current user)
    fastify.get('/my', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'Get my goals',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const goals = await prisma.goal.findMany({
            where: {
                costCenterId: request.user!.costCenterId,
                userId: request.user!.id,
                isActive: true,
            },
            orderBy: { periodEnd: 'asc' },
        });

        const goalsWithProgress = goals.map((g) => ({
            ...g,
            progressPercent: Math.min((g.currentValue / g.targetValue) * 100, 100),
            remaining: Math.max(g.targetValue - g.currentValue, 0),
            daysLeft: Math.ceil((g.periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            periodStart: g.periodStart.toISOString(),
            periodEnd: g.periodEnd.toISOString(),
        }));

        const response: ApiResponse = {
            success: true,
            data: goalsWithProgress,
        };

        return reply.send(response);
    });

    // Create goal
    fastify.post('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'Create goal',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createGoalSchema.parse(request.body);

        // If userId specified, verify user belongs to restaurant
        if (body.userId) {
            const user = await prisma.user.findFirst({
                where: { id: body.userId, costCenterId: request.user!.costCenterId },
            });
            if (!user) {
                throw errors.notFound('User not found');
            }
        }

        const goal = await prisma.goal.create({
            data: {
                ...body,
                costCenterId: request.user!.costCenterId!,
                periodStart: new Date(body.periodStart),
                periodEnd: new Date(body.periodEnd),
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...goal,
                progressPercent: 0,
                periodStart: goal.periodStart.toISOString(),
                periodEnd: goal.periodEnd.toISOString(),
                createdAt: goal.createdAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update goal progress
    fastify.patch<{ Params: { id: string }; Body: { currentValue: number } }>('/:id/progress', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'Update goal progress',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { currentValue } = request.body;

        const goal = await prisma.goal.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId,
            },
        });

        if (!goal) {
            throw errors.notFound('Goal not found');
        }

        const achievedNow = currentValue >= goal.targetValue && !goal.achievedAt;

        const updated = await prisma.goal.update({
            where: { id: request.params.id },
            data: {
                currentValue,
                ...(achievedNow && { achievedAt: new Date() }),
            },
        });

        // Create achievement alert if just achieved
        if (achievedNow) {
            await prisma.alert.create({
                data: {
                    costCenterId: request.user!.costCenterId!,
                    type: 'GOAL_ACHIEVED',
                    severity: 'LOW',
                    title: `Meta Atingida: ${goal.name}`,
                    message: `Parabéns! A meta "${goal.name}" foi atingida!`,
                    data: { goalId: goal.id, targetValue: goal.targetValue, currentValue },
                    actionUrl: '/goals',
                },
            });

            // Award points if user-specific
            if (goal.userId && goal.rewardPoints > 0) {
                await prisma.achievement.create({
                    data: {
                        userId: goal.userId,
                        badgeName: 'Meta Atingida',
                        badgeCategory: 'SALES',
                        description: `Atingiu a meta: ${goal.name}`,
                        pointsAwarded: goal.rewardPoints,
                    },
                });
            }
        }

        const response: ApiResponse = {
            success: true,
            data: {
                id: updated.id,
                currentValue: updated.currentValue,
                progressPercent: (updated.currentValue / updated.targetValue) * 100,
                achieved: !!updated.achievedAt,
                achievedAt: updated.achievedAt?.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Delete goal
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'Delete goal',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const goal = await prisma.goal.findFirst({
            where: {
                id: request.params.id,
                costCenterId: request.user!.costCenterId,
            },
        });

        if (!goal) {
            throw errors.notFound('Goal not found');
        }

        await prisma.goal.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Goal deleted' },
        };

        return reply.send(response);
    });

    // Get leaderboard
    fastify.get('/leaderboard', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'Get goals leaderboard',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        // Get total points per user
        const achievements = await prisma.achievement.groupBy({
            by: ['userId'],
            where: {
                user: { costCenterId: request.user!.costCenterId },
            },
            _sum: { pointsAwarded: true },
            _count: true,
            orderBy: { _sum: { pointsAwarded: 'desc' } },
            take: 10,
        });

        const userIds = achievements.map((a) => a.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });

        const userMap = new Map(users.map((u) => [u.id, u]));

        const leaderboard = achievements.map((a, index) => ({
            rank: index + 1,
            user: userMap.get(a.userId),
            totalPoints: a._sum.pointsAwarded || 0,
            achievementCount: a._count,
        }));

        const response: ApiResponse = {
            success: true,
            data: leaderboard,
        };

        return reply.send(response);
    });

    // Get user achievements
    fastify.get<{ Params: { userId: string } }>('/achievements/:userId', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Goals'],
            summary: 'Get user achievements',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const achievements = await prisma.achievement.findMany({
            where: {
                userId: request.params.userId,
                user: { costCenterId: request.user!.costCenterId },
            },
            orderBy: { earnedAt: 'desc' },
        });

        const totalPoints = achievements.reduce((sum, a) => sum + a.pointsAwarded, 0);

        const response: ApiResponse = {
            success: true,
            data: {
                achievements: achievements.map((a) => ({
                    ...a,
                    earnedAt: a.earnedAt.toISOString(),
                })),
                totalPoints,
            },
        };

        return reply.send(response);
    });
}
