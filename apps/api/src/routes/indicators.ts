import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database'; // Adjusted import based on monorepo structure
import { authenticate } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
// import { UserRole } from 'types'; // Not used directly in this file anymore
import { calculateIndicatorValue } from '../services/indicator-service';
import { Indicator } from '@prisma/client';

const STANDARD_INDICATORS: Partial<Indicator>[] = [
    { type: 'STOCK_CMV', name: 'CMV de Estoque', description: 'Custo da mercadoria vendida baseada nas saídas de estoque.', targetValue: 30, cycle: 'MONTHLY' },
    { type: 'PURCHASING', name: 'Compras vs Meta', description: 'Volume de compras em relação à meta de CMV.', targetValue: 30, cycle: 'MONTHLY' },
    { type: 'RECIPE_COVERAGE', name: 'Cobertura de Fichas', description: 'Porcentagem do cardápio com fichas técnicas.', targetValue: 100, cycle: 'MONTHLY' },
    { type: 'WASTE_PERCENT', name: 'Desperdício (%)', description: 'Perdas e quebras em relação ao faturamento.', targetValue: 2, cycle: 'MONTHLY' },
    { type: 'WASTE_PERCENT', name: 'Desperdício (%)', description: 'Perdas e quebras em relação ao faturamento.', targetValue: 2, cycle: 'MONTHLY' },
    { type: 'REVENUE', name: 'Faturamento', description: 'Receita total de vendas no período.', targetValue: 100000, cycle: 'MONTHLY' },
    { type: 'STOCK_ACCURACY' as any, name: 'Precisão de Estoque', description: 'Porcentagem de itens com contagem correta no inventário.', targetValue: 98, cycle: 'MONTHLY' },
    { type: 'MANUAL_RATING' as any, name: 'Nota iFood', description: 'Nota média de avaliação (iFood/Google).', targetValue: 5, cycle: 'MONTHLY' },
];

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
            return [];
        }

        // Auto-seed standard indicators if missing for this cost center (ALWAYS, not just for configurers)
        const existingIndicators = await prisma.indicator.findMany({
            where: { costCenterId },
            select: { type: true }
        });
        const existingTypes = new Set(existingIndicators.map(i => i.type));
        const missing = STANDARD_INDICATORS.filter(std => !existingTypes.has(std.type as any));

        if (missing.length > 0) {
            for (const std of missing) {
                await prisma.indicator.create({
                    data: {
                        ...std,
                        costCenterId,
                        targetValue: std.targetValue || 0,
                        periodStart: new Date(),
                        periodEnd: new Date(),
                        isActive: false // Start inactive so user can enable
                    } as any
                });
            }
        }

        const canConfigure = permissions?.indicators?.configure;

        // Build Filter
        const whereClause: any = {
            costCenterId, // Scoped to Cost Center
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

        // Calculate current values for dynamic indicators
        const indicatorsWithValues = await Promise.all(indicators.map(async (ind) => {
            if (ind.isActive) {
                try {
                    const value = await calculateIndicatorValue(ind);
                    return { ...ind, currentValue: value };
                } catch (e) {
                    request.log.error(`Error calculating indicator ${ind.id}:`, e);
                    return ind;
                }
            }
            return ind;
        }));

        return indicatorsWithValues;
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
