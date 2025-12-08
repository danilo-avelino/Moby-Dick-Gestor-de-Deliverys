import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from 'database';
import { errors } from '../middleware/error-handler';
import { authenticate } from '../middleware/auth';
import type { LoginRequest, LoginResponse, RegisterRequest, ApiResponse } from 'types';

const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    restaurantName: z.string().min(2, 'Restaurant name is required'),
    phone: z.string().optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
    // Login
    fastify.post<{ Body: LoginRequest }>('/login', {
        schema: {
            tags: ['Auth'],
            summary: 'User login',
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 6 },
                },
            },
        },
    }, async (request, reply) => {
        const body = loginSchema.parse(request.body);

        const user = await prisma.user.findUnique({
            where: { email: body.email },
            include: { restaurant: true },
        });

        if (!user) {
            throw errors.unauthorized('Invalid credentials');
        }

        if (!user.isActive) {
            throw errors.unauthorized('Account is inactive');
        }

        const validPassword = await bcrypt.compare(body.password, user.passwordHash);
        if (!validPassword) {
            throw errors.unauthorized('Invalid credentials');
        }

        // Generate tokens
        const accessToken = fastify.jwt.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
            restaurantId: user.restaurantId,
        });

        const refreshToken = fastify.jwt.sign(
            { sub: user.id, type: 'refresh' },
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
        );

        // Save session
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await prisma.session.create({
            data: {
                userId: user.id,
                token: accessToken.slice(-50), // Store last 50 chars for lookup
                refreshToken,
                expiresAt,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
            },
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        const response: ApiResponse<LoginResponse> = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone || undefined,
                    avatarUrl: user.avatarUrl || undefined,
                    role: user.role as any,
                    restaurantId: user.restaurantId || undefined,
                    restaurant: user.restaurant ? {
                        id: user.restaurant.id,
                        name: user.restaurant.name,
                        tradeName: user.restaurant.tradeName || undefined,
                        settings: {
                            timezone: user.restaurant.timezone,
                            currency: user.restaurant.currency,
                            locale: user.restaurant.locale,
                            targetCmvPercent: user.restaurant.targetCmvPercent,
                            alertCmvThreshold: user.restaurant.alertCmvThreshold,
                            primaryColor: user.restaurant.primaryColor,
                            secondaryColor: user.restaurant.secondaryColor,
                        },
                        createdAt: user.restaurant.createdAt.toISOString(),
                    } : undefined,
                    createdAt: user.createdAt.toISOString(),
                },
                accessToken,
                refreshToken,
                expiresAt: expiresAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Register
    fastify.post<{ Body: RegisterRequest }>('/register', {
        schema: {
            tags: ['Auth'],
            summary: 'Register new user and restaurant',
        },
    }, async (request, reply) => {
        const body = registerSchema.parse(request.body);

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email: body.email },
        });

        if (existingUser) {
            throw errors.conflict('Email already registered');
        }

        // Create restaurant and user in transaction
        const result = await prisma.$transaction(async (tx) => {
            const restaurant = await tx.restaurant.create({
                data: {
                    name: body.restaurantName,
                },
            });

            const passwordHash = await bcrypt.hash(body.password, 10);

            const user = await tx.user.create({
                data: {
                    email: body.email,
                    passwordHash,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    phone: body.phone,
                    role: 'ADMIN',
                    restaurantId: restaurant.id,
                },
                include: { restaurant: true },
            });

            return user;
        });

        // Generate tokens
        const accessToken = fastify.jwt.sign({
            sub: result.id,
            email: result.email,
            role: result.role,
            restaurantId: result.restaurantId,
        });

        const refreshToken = fastify.jwt.sign(
            { sub: result.id, type: 'refresh' },
            { expiresIn: '30d' }
        );

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await prisma.session.create({
            data: {
                userId: result.id,
                token: accessToken.slice(-50),
                refreshToken,
                expiresAt,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                user: {
                    id: result.id,
                    email: result.email,
                    firstName: result.firstName,
                    lastName: result.lastName,
                    role: result.role,
                    restaurantId: result.restaurantId,
                    createdAt: result.createdAt.toISOString(),
                },
                accessToken,
                refreshToken,
                expiresAt: expiresAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Refresh token
    fastify.post<{ Body: { refreshToken: string } }>('/refresh', {
        schema: {
            tags: ['Auth'],
            summary: 'Refresh access token',
        },
    }, async (request, reply) => {
        const { refreshToken } = request.body;

        if (!refreshToken) {
            throw errors.badRequest('Refresh token is required');
        }

        // Verify refresh token
        let decoded: any;
        try {
            decoded = fastify.jwt.verify(refreshToken);
        } catch {
            throw errors.unauthorized('Invalid refresh token');
        }

        if (decoded.type !== 'refresh') {
            throw errors.unauthorized('Invalid token type');
        }

        // Find session
        const session = await prisma.session.findFirst({
            where: { refreshToken, userId: decoded.sub },
            include: { user: true },
        });

        if (!session || session.expiresAt < new Date()) {
            throw errors.unauthorized('Session expired');
        }

        if (!session.user.isActive) {
            throw errors.unauthorized('Account is inactive');
        }

        // Generate new tokens
        const newAccessToken = fastify.jwt.sign({
            sub: session.user.id,
            email: session.user.email,
            role: session.user.role,
            restaurantId: session.user.restaurantId,
        });

        const newRefreshToken = fastify.jwt.sign(
            { sub: session.user.id, type: 'refresh' },
            { expiresIn: '30d' }
        );

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Update session
        await prisma.session.update({
            where: { id: session.id },
            data: {
                token: newAccessToken.slice(-50),
                refreshToken: newRefreshToken,
                expiresAt,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresAt: expiresAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Logout
    fastify.post('/logout', {
        preHandler: [authenticate],
        schema: {
            tags: ['Auth'],
            summary: 'Logout user',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '').slice(-50);
            await prisma.session.deleteMany({
                where: { token },
            });
        }

        const response: ApiResponse = {
            success: true,
            data: { message: 'Logged out successfully' },
        };

        return reply.send(response);
    });

    // Get current user
    fastify.get('/me', {
        preHandler: [authenticate],
        schema: {
            tags: ['Auth'],
            summary: 'Get current user',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const user = await prisma.user.findUnique({
            where: { id: request.user!.id },
            include: { restaurant: true },
        });

        if (!user) {
            throw errors.notFound('User not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                avatarUrl: user.avatarUrl,
                role: user.role,
                restaurantId: user.restaurantId,
                restaurant: user.restaurant ? {
                    id: user.restaurant.id,
                    name: user.restaurant.name,
                    tradeName: user.restaurant.tradeName,
                    logoUrl: user.restaurant.logoUrl,
                    settings: {
                        timezone: user.restaurant.timezone,
                        currency: user.restaurant.currency,
                        locale: user.restaurant.locale,
                        targetCmvPercent: user.restaurant.targetCmvPercent,
                        alertCmvThreshold: user.restaurant.alertCmvThreshold,
                        primaryColor: user.restaurant.primaryColor,
                        secondaryColor: user.restaurant.secondaryColor,
                    },
                } : null,
                createdAt: user.createdAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Change password
    fastify.post<{ Body: { currentPassword: string; newPassword: string } }>('/change-password', {
        preHandler: [authenticate],
        schema: {
            tags: ['Auth'],
            summary: 'Change password',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { currentPassword, newPassword } = request.body;

        const user = await prisma.user.findUnique({
            where: { id: request.user!.id },
        });

        if (!user) {
            throw errors.notFound('User not found');
        }

        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            throw errors.badRequest('Current password is incorrect');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        // Invalidate all sessions except current
        const authHeader = request.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '').slice(-50);
            await prisma.session.deleteMany({
                where: {
                    userId: user.id,
                    NOT: { token },
                },
            });
        }

        const response: ApiResponse = {
            success: true,
            data: { message: 'Password changed successfully' },
        };

        return reply.send(response);
    });
}
