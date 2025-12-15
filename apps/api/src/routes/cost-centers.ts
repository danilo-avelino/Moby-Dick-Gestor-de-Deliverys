import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { authenticate, requireRole } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { UserRole, type ApiResponse } from 'types';

const updateCostCenterSchema = z.object({
    name: z.string().min(2).optional(),
    tradeName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')).transform(v => v === '' ? null : v),
    phone: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal('')).transform(v => v === '' ? null : v),
    cnpj: z.string().optional().transform(v => v === '' ? null : v),
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    timezone: z.string().optional(),
    currency: z.string().optional(),
    locale: z.string().optional(),
    targetCmvPercent: z.number().min(0).max(100).optional(),
    alertCmvThreshold: z.number().min(0).max(100).optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
});

export async function costCenterRoutes(fastify: FastifyInstance) {

    // --- ADMIN / DIRECTOR ROUTES ---

    // LIST ALL CostCenters (Admin/Director)
    fastify.get('/', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { search, status } = request.query as { search?: string, status?: string };
        const where: any = {};

        // Organization Filter
        if (request.user.role !== 'SUPER_ADMIN') {
            if (!request.user.organizationId) {
                return reply.send({ success: true, data: [] });
            }
            where.organizationId = request.user.organizationId;
        }

        // Permission Filter (for non-org admins)
        if (request.user.scope === 'RESTAURANTS' && request.user.role !== 'SUPER_ADMIN') { // TODO: Check if scope name RESTAURANTS should be COST_CENTERS now? Keeping generic map for now.
            const allowedIds = request.user.permissions?.allowedCostCenterIds;
            if (Array.isArray(allowedIds)) {
                where.id = { in: allowedIds };
            }
        }

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (status) {
            where.isActive = status === 'active';
        }

        const costCenters = await prisma.costCenter.findMany({
            where,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                cnpj: true,
                isActive: true,
                city: true,
                state: true,
                createdAt: true,
                _count: {
                    select: { users: true }
                }
            }
        });

        return reply.send({ success: true, data: costCenters });
    });

    // CREATE CostCenter
    fastify.post('/', {
        preHandler: [requireRole(UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN)],
    }, async (request, reply) => {
        const body = z.object({
            name: z.string().min(2),
            cnpj: z.string().optional().transform(v => v === '' ? undefined : v),
            phone: z.string().optional(),
            email: z.string().email().optional().or(z.literal('')),
            street: z.string().optional(),
            number: z.string().optional(),
            neighborhood: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            isActive: z.boolean().default(true),
        }).parse(request.body);

        if (body.cnpj) {
            const existing = await prisma.costCenter.findUnique({
                where: { cnpj: body.cnpj }
            });
            if (existing) {
                throw errors.conflict('CNPJ já cadastrado');
            }
        }

        // Ensure organization context
        const organizationId = request.user.organizationId;
        if (!organizationId && request.user.role !== 'SUPER_ADMIN') {
            throw errors.badRequest('User must belong to an organization to create a cost center');
        }

        const costCenter = await prisma.costCenter.create({
            data: {
                ...body,
                organizationId: organizationId // Link to Org
            }
        });

        // Grant access if needed
        if (request.user.scope === 'RESTAURANTS' && request.user.id) { // Pending rename to COST_CENTERS scope?
            await prisma.userCostCenterAccess.create({
                data: {
                    userId: request.user.id,
                    costCenterId: costCenter.id,
                    organizationId: organizationId!
                }
            });
        }

        return reply.status(201).send({ success: true, data: costCenter });
    });

    // UPDATE CostCenter
    fastify.put<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRole(UserRole.DIRETOR, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        const { id } = request.params;
        const body = updateCostCenterSchema.parse(request.body);

        if (body.cnpj) {
            const existing = await prisma.costCenter.findUnique({
                where: { cnpj: body.cnpj }
            });
            if (existing && existing.id !== id) {
                throw errors.conflict('CNPJ já cadastrado em outro centro de custo');
            }
        }

        const costCenter = await prisma.costCenter.update({
            where: { id },
            data: body,
        });

        return reply.send({ success: true, data: costCenter });
    });

    // TOGGLE STATUS
    fastify.patch<{ Params: { id: string }, Body: { isActive: boolean } }>('/:id/status', {
        preHandler: [requireRole(UserRole.DIRETOR, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        const { id } = request.params;
        const { isActive } = request.body;

        await prisma.costCenter.update({
            where: { id },
            data: { isActive }
        });

        return reply.send({ success: true, data: { message: 'Status atualizado' } });
    });

    // --- EXISTING ROUTES ---

    // Get current cost center
    fastify.get('/current', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        if (!request.user?.costCenterId) {
            throw errors.notFound('No cost center associated');
        }

        const costCenter = await prisma.costCenter.findUnique({
            where: { id: request.user.costCenterId },
            include: {
                _count: {
                    select: {
                        users: true,
                        // products: true, // REMOVED from CC scope
                        // recipes: true, // REMOVED from CC scope
                        integrations: true,
                    },
                },
            },
        });

        if (!costCenter) {
            throw errors.notFound('Cost Center not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...costCenter,
                planExpiresAt: costCenter.planExpiresAt?.toISOString(),
                createdAt: costCenter.createdAt.toISOString(),
                updatedAt: costCenter.updatedAt.toISOString(),
                stats: costCenter._count,
            },
        };

        return reply.send(response);
    });

    // Update current cost center
    fastify.patch('/current', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        if (!request.user?.costCenterId) {
            throw errors.notFound('No cost center associated');
        }

        const body = updateCostCenterSchema.parse(request.body);

        const costCenter = await prisma.costCenter.update({
            where: { id: request.user.costCenterId },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: costCenter.id,
                name: costCenter.name,
                tradeName: costCenter.tradeName,
                updatedAt: costCenter.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Get cost center users
    fastify.get('/current/users', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        if (!request.user?.costCenterId) {
            throw errors.notFound('No cost center associated');
        }

        const users = await prisma.user.findMany({
            where: { costCenterId: request.user.costCenterId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const response: ApiResponse = {
            success: true,
            data: users.map((u) => ({
                ...u,
                lastLoginAt: u.lastLoginAt?.toISOString(),
                createdAt: u.createdAt.toISOString(),
            })),
        };

        return reply.send(response);
    });

    // Invite user
    fastify.post<{ Body: { email: string; firstName: string; lastName: string; role: string } }>('/current/users', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        if (!request.user?.costCenterId) {
            throw errors.notFound('No cost center associated');
        }

        const { email, firstName, lastName, role } = request.body;

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw errors.conflict('Email already registered');
        }

        const bcrypt = await import('bcryptjs');
        const tempPassword = Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const user = await prisma.user.create({
            data: {
                email,
                firstName,
                lastName,
                passwordHash,
                role: role as any,
                costCenterId: request.user.costCenterId,
                organizationId: request.user.organizationId, // Ensure org link
            },
        });

        await prisma.userCostCenterAccess.create({
            data: {
                userId: user.id,
                costCenterId: request.user.costCenterId!,
                organizationId: request.user.organizationId!,
            }
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                tempPassword,
                createdAt: user.createdAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update user
    fastify.patch<{ Params: { userId: string }; Body: { role?: string; isActive?: boolean } }>('/current/users/:userId', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        const { userId } = request.params;
        const { role, isActive } = request.body;

        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                costCenterId: request.user?.costCenterId,
            },
        });

        if (!user) {
            throw errors.notFound('User not found');
        }

        if (userId === request.user?.id && isActive === false) {
            throw errors.badRequest('Cannot deactivate yourself');
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(role && { role: role as any }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: updated.id,
                email: updated.email,
                role: updated.role,
                isActive: updated.isActive,
            },
        };

        return reply.send(response);
    });

    // Delete user
    fastify.delete<{ Params: { userId: string } }>('/current/users/:userId', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)],
    }, async (request, reply) => {
        const { userId } = request.params;

        if (userId === request.user?.id) {
            throw errors.badRequest('Cannot delete yourself');
        }

        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                costCenterId: request.user?.costCenterId,
            },
        });

        if (!user) {
            throw errors.notFound('User not found');
        }

        await prisma.user.delete({
            where: { id: userId },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'User deleted successfully' },
        };

        return reply.send(response);
    });
}
