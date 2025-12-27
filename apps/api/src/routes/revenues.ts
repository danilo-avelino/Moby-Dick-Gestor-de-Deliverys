
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import type { ApiResponse } from 'types';

const RevenueSchema = z.object({
    startDate: z.string().or(z.date()).transform(d => new Date(d)),
    endDate: z.string().or(z.date()).transform(d => new Date(d)),
    totalAmount: z.number().min(0),
    notes: z.string().optional(),
});

export async function revenueRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', requireCostCenter);

    // List revenues
    fastify.get<{
        Querystring: { startDate?: string; endDate?: string; allCenters?: string }
    }>('/', {
        schema: {
            tags: ['Financial'],
            summary: 'List revenues',
            querystring: {
                type: 'object',
                properties: {
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    allCenters: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { startDate, endDate, allCenters } = request.query;

        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();

        const where: any = {
            startDate: { gte: start },
            endDate: { lte: end }
        };

        // Filter logic
        if (allCenters === 'true') {
            // If super admin, fetch all (or maybe still restrict? Let's restrict to scope for safety)
            // Ideally, we respect allowedCostCenterIds
            if (request.user!.role === 'SUPER_ADMIN') {
                // No filter needed
            } else {
                const allowed = request.user!.permissions?.allowedCostCenterIds;
                if (Array.isArray(allowed)) {
                    where.costCenterId = { in: allowed };
                } else if (allowed === 'ALL') {
                    // No filter needed
                } else {
                    // Fallback to current context if no explicit permissions found (shouldn't happen with middleware but safe)
                    where.costCenterId = request.user!.costCenterId;
                }
            }
        } else {
            // Default behavior: Current context only
            where.costCenterId = request.user!.costCenterId;
        }

        const revenues = await prisma.revenue.findMany({
            where,
            orderBy: { startDate: 'desc' },
            include: {
                createdByUser: {
                    select: { firstName: true, lastName: true }
                },
                costCenter: {
                    select: { id: true, name: true }
                }
            }
        });

        return reply.send({ success: true, data: revenues });
    });

    // Create revenue
    fastify.post<{
        Body: z.infer<typeof RevenueSchema> & { costCenterId?: string }
    }>('/', {
        schema: {
            tags: ['Financial'],
            summary: 'Create revenue'
        }
    }, async (request, reply) => {
        try {
            console.log('Creating revenue payload:', JSON.stringify(request.body));

            // Manual validation
            const payload = RevenueSchema.parse(request.body);
            const bodyCostCenterId = (request.body as any).costCenterId;

            // Determine effective Cost Center ID
            let effectiveCostCenterId = request.user?.costCenterId;

            // If provided in body, validate permission and use it
            if (bodyCostCenterId) {
                const perms = request.user?.permissions?.allowedCostCenterIds;
                const canAccess = perms === 'ALL' || (Array.isArray(perms) && perms.includes(bodyCostCenterId));

                if (!canAccess) {
                    return reply.status(403).send({
                        success: false,
                        error: 'Forbidden',
                        message: 'Você não tem permissão para registrar faturamento neste centro de custo.'
                    });
                }
                effectiveCostCenterId = bodyCostCenterId;
            }

            // Final check for context
            if (!effectiveCostCenterId) {
                return reply.status(400).send({
                    success: false,
                    error: 'Context Error',
                    message: 'É necessário selecionar um restaurante/centro de custo para registrar o faturamento.'
                });
            }

            const revenue = await prisma.revenue.create({
                data: {
                    costCenterId: effectiveCostCenterId,
                    startDate: payload.startDate,
                    endDate: payload.endDate,
                    totalAmount: payload.totalAmount,
                    notes: payload.notes,
                    createdByUserId: request.user!.id
                }
            });

            return reply.send({ success: true, data: revenue });
        } catch (error) {
            console.error('Error creating revenue:', error);
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ success: false, error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ success: false, error: 'Internal Server Error' });
        }
    });

    // Update revenue
    fastify.put<{
        Params: { id: string },
        Body: Partial<z.infer<typeof RevenueSchema>>
    }>('/:id', {
        schema: {
            tags: ['Financial'],
            summary: 'Update revenue'
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const payload = RevenueSchema.partial().parse(request.body);

        const revenue = await prisma.revenue.update({
            where: {
                id,
                costCenterId: request.user!.costCenterId // Security check
            },
            data: {
                startDate: payload.startDate,
                endDate: payload.endDate,
                totalAmount: payload.totalAmount,
                notes: payload.notes
            }
        });

        return reply.send({ success: true, data: revenue });
    });

    // Delete revenue
    fastify.delete<{
        Params: { id: string }
    }>('/:id', {
        schema: {
            tags: ['Financial'],
            summary: 'Delete revenue'
        }
    }, async (request, reply) => {
        const { id } = request.params;

        await prisma.revenue.delete({
            where: {
                id,
                costCenterId: request.user!.costCenterId // Security check
            }
        });

        return reply.send({ success: true });
    });
}
