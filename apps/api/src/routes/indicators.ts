import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database'; // Adjusted import based on monorepo structure
import { authenticate } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
// import { UserRole } from 'types'; // Not used directly in this file anymore

const updateIndicatorSchema = z.object({
    targetValue: z.number().optional(),
    cycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM']).optional(),
    ownerId: z.string().optional().nullable(),
    accessUserIds: z.array(z.string()).optional(), // Users who can view (Interessados)
    isActive: z.boolean().optional(),
});

const createCommentSchema = z.object({
    message: z.string().min(1),
});

export async function indicatorRoutes(fastify: FastifyInstance) {
    fastify.addHook('onRequest', authenticate);

    // GET /indicators - List
    fastify.get('/', async (request) => {
        const { costCenterId, permissions, id: userId } = request.user;

        if (!costCenterId) {
            throw errors.badRequest('User has no cost center');
        }

        const canConfigure = permissions?.indicators?.configure;

        // Build Filter
        const whereClause: any = {
            costCenterId, // Scoped to Cost Center
            // If not configurer (Staff), logic:
            // "Interessados: Apenas visualizam. Usuário não selecionado não vê."
            // So if !canConfigure, must be in access list.
        };

        if (!canConfigure) {
            whereClause.access = {
                some: {
                    userId: userId
                }
            };
        }

        const indicators = await prisma.indicator.findMany({
            where: whereClause,
            include: {
                owner: {
                    select: { id: true, firstName: true, lastName: true, avatarUrl: true }
                },
                // Include latest result? Or just basic info?
                results: {
                    orderBy: { date: 'desc' },
                    take: 1
                },
                access: {
                    select: { userId: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return indicators;
    });

    // GET /indicators/:id - Details
    fastify.get<{ Params: { id: string } }>('/:id', async (request) => {
        const { id } = request.params;
        const { costCenterId, permissions, id: userId } = request.user;

        const indicator = await prisma.indicator.findUnique({
            where: { id },
            include: {
                owner: {
                    select: { id: true, firstName: true, lastName: true, avatarUrl: true }
                },
                access: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
                    }
                },
                results: {
                    orderBy: { date: 'desc' },
                    take: 20 // Recent history
                },
                comments: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!indicator) {
            throw errors.notFound('Indicator not found');
        }

        // Security check
        if (indicator.costCenterId !== costCenterId) {
            throw errors.forbidden('Access denied');
        }

        const canConfigure = permissions?.indicators?.configure;
        const hasAccess = indicator.access.some((a: any) => a.userId === userId);

        if (!canConfigure && !hasAccess) {
            throw errors.forbidden('You are not authorized to view this indicator');
        }

        return indicator;
    });

    // PUT /indicators/:id - Configure
    fastify.put<{ Params: { id: string }, Body: z.infer<typeof updateIndicatorSchema> }>('/:id', async (request) => {
        const { id } = request.params;
        const { permissions } = request.user;

        if (!permissions?.indicators?.configure) {
            throw errors.forbidden('Only Managers and Directors can configure indicators');
        }

        // Validate Body
        const data = updateIndicatorSchema.parse(request.body);

        // Transaction to update fields and access list
        const updated = await prisma.$transaction(async (tx) => {
            // Update basic fields
            const ind = await tx.indicator.update({
                where: { id },
                data: {
                    targetValue: data.targetValue,
                    cycle: data.cycle,
                    ownerId: data.ownerId,
                    isActive: data.isActive
                }
            });

            // Update Access List if provided
            if (data.accessUserIds) {
                // Delete existing not in list? Or fully replace?
                // "Persistir seleção". Usually replace.

                // 1. Remove all existing access (that are NOT in the new list - optimization)
                // OR simpler: delete all and re-create.
                await tx.indicatorAccess.deleteMany({
                    where: { indicatorId: id }
                });

                // 2. Create new
                if (data.accessUserIds.length > 0) {
                    await tx.indicatorAccess.createMany({
                        data: data.accessUserIds.map(uid => ({
                            indicatorId: id,
                            userId: uid
                        }))
                    });
                }
            }

            return ind;
        });

        return updated;
    });

    // POST /indicators/:id/chat - Send Message
    fastify.post<{ Params: { id: string }, Body: z.infer<typeof createCommentSchema> }>('/:id/chat', async (request) => {
        const { id } = request.params;
        const { id: userId, permissions, costCenterId } = request.user;
        const { message } = createCommentSchema.parse(request.body);

        // Check access
        const indicator = await prisma.indicator.findUnique({
            where: { id },
            include: { access: true }
        });

        if (!indicator || indicator.costCenterId !== costCenterId) {
            throw errors.notFound('Indicator not found');
        }

        const canConfigure = permissions?.indicators?.configure;
        const hasAccess = indicator.access.some((a: any) => a.userId === userId);

        if (!canConfigure && !hasAccess) {
            throw errors.forbidden('Access denied');
        }

        const comment = await prisma.indicatorComment.create({
            data: {
                indicatorId: id,
                userId,
                message
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
            }
        });

        return comment;
    });
}
