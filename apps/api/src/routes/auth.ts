import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from 'database';
import { errors } from '../middleware/error-handler';
import { authenticate } from '../middleware/auth';
import type { LoginRequest, LoginResponse, RegisterRequest, ApiResponse } from 'types';

const loginSchema = z.object({
    email: z.string().email('Invalid email').transform(e => e.toLowerCase().trim()),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
    email: z.string().email('Invalid email').transform(e => e.toLowerCase().trim()),
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
            include: {
                costCenter: true,
                organization: true
            },
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
            costCenterId: user.costCenterId,
            organizationId: user.organizationId,
            scope: user.scope
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
                    restaurantId: user.costCenterId || undefined, // Map CostCenter to RestaurantId for frontend compat
                    organizationId: user.organizationId || undefined,
                    restaurant: user.costCenter ? {
                        id: user.costCenter.id,
                        name: user.costCenter.name,
                        tradeName: user.costCenter.tradeName || undefined,
                        settings: {
                            // Default settings mapping since CostCenter might not have all check fields yet
                            timezone: 'America/Sao_Paulo',
                            currency: 'BRL',
                            locale: 'pt-BR',
                            targetCmvPercent: 30,
                            alertCmvThreshold: 35,
                            primaryColor: '#000000',
                            secondaryColor: '#ffffff',
                        },
                        createdAt: new Date().toISOString(), // Mock if needed or add to schema
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
            summary: 'Register new user and restaurant (creates Organization)',
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

        // Transaction: Org -> CostCenter -> User
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Organization
            // Generate a simple slug from restaurant name
            const slugBase = body.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const slug = `${slugBase}-${Math.random().toString(36).substring(2, 7)}`;

            const org = await tx.organization.create({
                data: {
                    name: body.restaurantName, // Use restaurant name for Org initially
                    slug: slug,
                    status: 'ACTIVE'
                }
            });

            // 2. Create CostCenter (formerly Restaurant) linked to Org
            const costCenter = await tx.costCenter.create({
                data: {
                    name: body.restaurantName,
                    organizationId: org.id
                },
            });

            const passwordHash = await bcrypt.hash(body.password, 10);

            // 3. Create User linked to Org and CostCenter
            const user = await tx.user.create({
                data: {
                    email: body.email,
                    passwordHash,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    phone: body.phone,
                    role: 'ADMIN', // Org Admin
                    scope: 'ORG', // Full scope
                    costCenterId: costCenter.id, // Default context
                    organizationId: org.id
                },
                include: { costCenter: true },
            });

            // 4. Create Access Record
            await tx.userCostCenterAccess.create({
                data: {
                    userId: user.id,
                    costCenterId: costCenter.id,
                    organizationId: org.id
                }
            });

            return user;
        });

        // Generate tokens
        const accessToken = fastify.jwt.sign({
            sub: result.id,
            email: result.email,
            role: result.role,
            costCenterId: result.costCenterId,
            organizationId: result.organizationId,
            scope: result.scope
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
                    restaurantId: result.costCenterId, // Compat
                    organizationId: result.organizationId,
                    createdAt: result.createdAt.toISOString(),
                },
                accessToken,
                refreshToken,
                expiresAt: expiresAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Switch Cost Center Context
    fastify.post<{ Body: { costCenterId: string } }>('/switch-cost-center', {
        preHandler: [authenticate],
        schema: {
            tags: ['Auth'],
            summary: 'Switch active cost center context',
        },
    }, async (request, reply) => {
        const { costCenterId } = request.body;
        const user = request.user!; // Populated by authenticate

        // Validate Access
        if (user.scope === 'ORG' || ['SUPER_ADMIN', 'DIRETOR', 'ADMIN'].includes(user.role)) {
            // Admin/Director check if costCenter belongs to Org
            if (user.organizationId) {
                const costCenter = await prisma.costCenter.findFirst({
                    where: { id: costCenterId, organizationId: user.organizationId }
                });
                if (!costCenter) throw errors.forbidden('Cost Center não pertence à sua organização');
            }
        } else {
            // Regular user, check permission list
            const allowed = user.permissions?.allowedCostCenterIds;
            if (allowed !== 'ALL' && !allowed?.includes(costCenterId)) {
                throw errors.forbidden('Acesso negado a este Cost Center');
            }
        }

        // Update User's default costCenterId
        await prisma.user.update({
            where: { id: user.id },
            data: { costCenterId }
        });

        // Issue new Token
        const accessToken = fastify.jwt.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
            costCenterId: costCenterId, // New Context
            organizationId: user.organizationId,
            scope: user.scope,
            impersonatedBy: user.impersonatedBy
        });

        // Return new token and user
        return reply.send({
            success: true,
            data: {
                accessToken,
                user: {
                    ...user,
                    costCenterId,
                    restaurantId: costCenterId // Compat
                }
            }
        });
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
            costCenterId: session.user.costCenterId,
            organizationId: session.user.organizationId,
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
            include: {
                costCenter: true,
                organization: true
            },
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
                restaurantId: user.costCenterId, // Compat
                organizationId: user.organizationId,
                restaurant: user.costCenter ? {
                    id: user.costCenter.id,
                    name: user.costCenter.name,
                    tradeName: user.costCenter.tradeName,
                    logoUrl: user.costCenter.logoUrl,
                    settings: {
                        timezone: 'America/Sao_Paulo',
                        currency: 'BRL',
                        locale: 'pt-BR',
                        targetCmvPercent: 30,
                        alertCmvThreshold: 35,
                        primaryColor: '#000000',
                        secondaryColor: '#ffffff',
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
