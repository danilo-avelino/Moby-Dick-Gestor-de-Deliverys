import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { authenticate, requireRole } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { UserRole, type ApiResponse } from 'types';

const updateRestaurantSchema = z.object({
    name: z.string().min(2).optional(),
    tradeName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    logoUrl: z.string().url().optional(),
    cnpj: z.string().optional(),
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

export async function restaurantRoutes(fastify: FastifyInstance) {
    // Get current restaurant
    fastify.get('/current', {
        preHandler: [authenticate],
        schema: {
            tags: ['Restaurants'],
            summary: 'Get current restaurant',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!request.user?.restaurantId) {
            throw errors.notFound('No restaurant associated');
        }

        const restaurant = await prisma.restaurant.findUnique({
            where: { id: request.user.restaurantId },
            include: {
                _count: {
                    select: {
                        users: true,
                        products: true,
                        recipes: true,
                        integrations: true,
                    },
                },
            },
        });

        if (!restaurant) {
            throw errors.notFound('Restaurant not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                id: restaurant.id,
                name: restaurant.name,
                tradeName: restaurant.tradeName,
                cnpj: restaurant.cnpj,
                email: restaurant.email,
                phone: restaurant.phone,
                logoUrl: restaurant.logoUrl,
                address: {
                    street: restaurant.street,
                    number: restaurant.number,
                    complement: restaurant.complement,
                    neighborhood: restaurant.neighborhood,
                    city: restaurant.city,
                    state: restaurant.state,
                    zipCode: restaurant.zipCode,
                    country: restaurant.country,
                },
                settings: {
                    timezone: restaurant.timezone,
                    currency: restaurant.currency,
                    locale: restaurant.locale,
                    targetCmvPercent: restaurant.targetCmvPercent,
                    alertCmvThreshold: restaurant.alertCmvThreshold,
                    primaryColor: restaurant.primaryColor,
                    secondaryColor: restaurant.secondaryColor,
                },
                plan: restaurant.plan,
                planExpiresAt: restaurant.planExpiresAt?.toISOString(),
                stats: restaurant._count,
                createdAt: restaurant.createdAt.toISOString(),
                updatedAt: restaurant.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Update restaurant
    fastify.patch('/current', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)],
        schema: {
            tags: ['Restaurants'],
            summary: 'Update current restaurant',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!request.user?.restaurantId) {
            throw errors.notFound('No restaurant associated');
        }

        const body = updateRestaurantSchema.parse(request.body);

        const restaurant = await prisma.restaurant.update({
            where: { id: request.user.restaurantId },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: restaurant.id,
                name: restaurant.name,
                tradeName: restaurant.tradeName,
                updatedAt: restaurant.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Get restaurant users
    fastify.get('/current/users', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)],
        schema: {
            tags: ['Restaurants'],
            summary: 'Get restaurant users',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!request.user?.restaurantId) {
            throw errors.notFound('No restaurant associated');
        }

        const users = await prisma.user.findMany({
            where: { restaurantId: request.user.restaurantId },
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
        schema: {
            tags: ['Restaurants'],
            summary: 'Invite user to restaurant',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!request.user?.restaurantId) {
            throw errors.notFound('No restaurant associated');
        }

        const { email, firstName, lastName, role } = request.body;

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw errors.conflict('Email already registered');
        }

        // Create user with temporary password
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
                restaurantId: request.user.restaurantId,
            },
        });

        // TODO: Send invitation email with temp password

        const response: ApiResponse = {
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                tempPassword, // In production, send via email only
                createdAt: user.createdAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update user
    fastify.patch<{ Params: { userId: string }; Body: { role?: string; isActive?: boolean } }>('/current/users/:userId', {
        preHandler: [requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)],
        schema: {
            tags: ['Restaurants'],
            summary: 'Update user in restaurant',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { userId } = request.params;
        const { role, isActive } = request.body;

        // Ensure user belongs to restaurant
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                restaurantId: request.user?.restaurantId,
            },
        });

        if (!user) {
            throw errors.notFound('User not found');
        }

        // Prevent self-deactivation
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
        schema: {
            tags: ['Restaurants'],
            summary: 'Remove user from restaurant',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { userId } = request.params;

        // Prevent self-deletion
        if (userId === request.user?.id) {
            throw errors.badRequest('Cannot delete yourself');
        }

        // Ensure user belongs to restaurant
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                restaurantId: request.user?.restaurantId,
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
