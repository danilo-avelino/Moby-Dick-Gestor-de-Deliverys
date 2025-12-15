import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { UserRole, ApiResponse } from 'types';

// Schema for creating a user
const createUserSchema = z.object({
    firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    lastName: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    role: z.nativeEnum(UserRole),
    costCenterId: z.string().optional().nullable(),
    isActive: z.boolean().optional().default(true),
}).refine(data => {
    if (data.role === UserRole.CHEF_DE_COZINHA && !data.costCenterId) {
        return false;
    }
    return true;
}, {
    message: "Restaurante é obrigatório para o cargo de Chef de Cozinha",
    path: ["restaurantId"] // Keep path as restaurantId for frontend error mapping
});

// Schema for updating a user
const updateUserSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.nativeEnum(UserRole).optional(),
    costCenterId: z.string().optional().nullable(),
    isActive: z.boolean().optional().default(true),
    password: z.string().min(6).optional(), // Optional reset
}).refine(data => {
    if (data.role === UserRole.CHEF_DE_COZINHA && !data.costCenterId) {
        // Only if role IS explicitly being set to Chef, OR if it's already Chef (handled in logic later, but Zod checks payload)
        // If payload has role=Chef, it MUST have costCenterId.
        return false;
    }
    return true;
}, {
    message: "Restaurante é obrigatório para o cargo de Chef de Cozinha",
    path: ["restaurantId"]
});


export async function userRoutes(fastify: FastifyInstance) {
    // Middleware to ensure user is logged in
    fastify.addHook('preHandler', authenticate);

    // Middleware to ensure user is DIRETOR
    const requireDiretor = async (request: any) => {
        if (request.user.role !== UserRole.DIRETOR) {
            throw errors.forbidden('Acesso restrito a Diretores');
        }
    };

    // GET / - List users
    fastify.get('/', {
        preHandler: [authenticate], // Check permission inside
    }, async (request, reply) => {
        // Access Check: Admin/Director/SuperAdmin
        if (!['SUPER_ADMIN', 'ADMIN', 'DIRETOR'].includes(request.user.role)) {
            throw errors.forbidden('Acesso restrito');
        }

        const { search, role, status, restaurantId } = request.query as { search?: string, role?: UserRole, status?: string, restaurantId?: string };

        const where: any = {};

        // Scope by Organization
        if (request.user.role !== 'SUPER_ADMIN') {
            if (request.user.organizationId) {
                where.organizationId = request.user.organizationId;
            }
        }

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (role) {
            where.role = role;
        }

        if (status) {
            where.isActive = status === 'active';
        }

        if (restaurantId) {
            where.costCenterId = restaurantId;
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                costCenter: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedUsers = users.map(u => ({
            ...u,
            restaurant: u.costCenter, // Map costCenter to restaurant for frontend
            costCenter: undefined,
        }));

        const response: ApiResponse = {
            success: true,
            data: formattedUsers,
        };

        return reply.send(response);
    });

    // POST / - Create User
    fastify.post('/', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        // Access Check: Admin/Director/SuperAdmin
        if (!['SUPER_ADMIN', 'ADMIN', 'DIRETOR'].includes(request.user.role)) {
            throw errors.forbidden('Acesso restrito');
        }

        const rawBody = request.body as any;
        // Map restaurantId to costCenterId before validation if needed, or rely on schema accepting costCenterId
        // Frontend sends restaurantId, so let's map it.
        const bodyToValidate = {
            ...rawBody,
            costCenterId: rawBody.restaurantId || rawBody.costCenterId
        };
        const body = createUserSchema.parse(bodyToValidate);

        // Check unique email
        const existing = await prisma.user.findUnique({ where: { email: body.email } });
        if (existing) {
            throw errors.conflict('Email já cadastrado');
        }

        const passwordHash = await bcrypt.hash(body.password, 10);

        // Ensure Org ID
        const organizationId = request.user.organizationId;

        const user = await prisma.user.create({
            data: {
                email: body.email,
                firstName: body.firstName,
                lastName: body.lastName,
                passwordHash,
                role: body.role,
                isActive: body.isActive ?? true,
                costCenterId: body.costCenterId || null,
                organizationId: organizationId
            }
        });

        // Create Access if restaurant assigned
        if (user.costCenterId && organizationId) {
            await prisma.userCostCenterAccess.create({
                data: {
                    userId: user.id,
                    costCenterId: user.costCenterId,
                    organizationId: organizationId
                }
            });
        }

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'Usuário criado com sucesso',
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                }
            },
        };

        return reply.status(201).send(response);
    });

    // GET /:id - Get User Details
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id } = request.params;

        // Access check done via where query scoping
        const where: any = { id };
        if (request.user.role !== 'SUPER_ADMIN' && request.user.organizationId) {
            where.organizationId = request.user.organizationId;
        }

        const user = await prisma.user.findFirst({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                costCenterId: true,
                costCenter: { select: { id: true, name: true } }
            }
        });

        if (!user) {
            throw errors.notFound('Usuário não encontrado');
        }

        const formattedUser = {
            ...user,
            restaurantId: user.costCenterId,
            restaurant: user.costCenter,
            costCenterId: undefined,
            costCenter: undefined,
        };

        const response: ApiResponse = {
            success: true,
            data: formattedUser,
        };

        return reply.send(response);
    });

    // PUT /:id - Update User
    fastify.put<{ Params: { id: string } }>('/:id', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        // Access Check: Admin/Director/SuperAdmin
        if (!['SUPER_ADMIN', 'ADMIN', 'DIRETOR'].includes(request.user.role)) {
            throw errors.forbidden('Acesso restrito');
        }

        const { id } = request.params;
        const rawBody = request.body as any;
        const bodyToValidate = {
            ...rawBody,
            costCenterId: rawBody.restaurantId || rawBody.costCenterId
        };
        const body = updateUserSchema.parse(bodyToValidate);

        // Ensure user belongs to same org
        const where: any = { id };
        if (request.user.role !== 'SUPER_ADMIN' && request.user.organizationId) {
            where.organizationId = request.user.organizationId;
        }

        const currentUser = await prisma.user.findFirst({ where }); // Changed findUnique to findFirst for scope check
        if (!currentUser) {
            throw errors.notFound('Usuário não encontrado');
        }

        // Email uniqueness check if changing
        if (body.email && body.email !== currentUser.email) {
            const existing = await prisma.user.findUnique({ where: { email: body.email } });
            if (existing) {
                throw errors.conflict('Email já está em uso por outro usuário');
            }
        }

        // Validate Chef Logic
        const nextRole = body.role || currentUser.role;
        const nextCostCenterId = body.costCenterId !== undefined ? body.costCenterId : currentUser.costCenterId;

        if (nextRole === UserRole.CHEF_DE_COZINHA && !nextCostCenterId) {
            throw errors.badRequest('Obrigatório informar restaurante para Chef de Cozinha');
        }

        // Prevent locking out all Directors/Admins
        if ((currentUser.role === UserRole.DIRETOR || currentUser.role === UserRole.ADMIN) && body.role && body.role !== currentUser.role) {
            const adminCount = await prisma.user.count({
                where: {
                    role: { in: [UserRole.DIRETOR, UserRole.ADMIN] },
                    isActive: true,
                    organizationId: currentUser.organizationId // Scoped check
                }
            });
            if (adminCount <= 1) {
                throw errors.badRequest('Não é possível remover o último Administrador ativo da organização.');
            }
        }

        const dataToUpdate: any = {
            ...body,
            costCenterId: nextRole === UserRole.CHEF_DE_COZINHA ? nextCostCenterId : (body.costCenterId === undefined ? undefined : body.costCenterId),
        };
        delete dataToUpdate.restaurantId; // Ensure we don't try to save restaurantId if it leaked into body

        if (body.password) {
            dataToUpdate.passwordHash = await bcrypt.hash(body.password, 10);
            delete dataToUpdate.password;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: dataToUpdate,
        });

        // Update Access if restaurant changed
        if (updatedUser.costCenterId && currentUser.organizationId) {
            // Check if access exists
            const existingAccess = await prisma.userCostCenterAccess.findUnique({
                where: { userId_costCenterId: { userId: updatedUser.id, costCenterId: updatedUser.costCenterId } }
            });
            if (!existingAccess) {
                await prisma.userCostCenterAccess.create({
                    data: {
                        userId: updatedUser.id,
                        costCenterId: updatedUser.costCenterId,
                        organizationId: currentUser.organizationId
                    }
                });
            }
        }

        const response: ApiResponse = {
            success: true,
            data: { message: 'Usuário atualizado com sucesso' },
        };

        return reply.send(response);
    });

    // PATCH /:id/status - Update Status
    fastify.patch<{ Params: { id: string }, Body: { isActive: boolean } }>('/:id/status', {
        preHandler: [requireDiretor],
    }, async (request, reply) => {
        const { id } = request.params;
        const { isActive } = request.body;

        const currentUser = await prisma.user.findUnique({ where: { id } });
        if (!currentUser) throw errors.notFound('Usuário não encontrado');

        if (currentUser.role === UserRole.DIRETOR && !isActive) {
            // Check if last director
            const directorCount = await prisma.user.count({
                where: { role: UserRole.DIRETOR, isActive: true }
            });
            if (directorCount <= 1 && currentUser.isActive) { // If currently active and trying to deactivate
                throw errors.badRequest('Não é possível desativar o último Diretor do sistema.');
            }
        }

        await prisma.user.update({
            where: { id },
            data: { isActive }
        });

        const response: ApiResponse = {
            success: true,
            data: { message: `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso` },
        };

        return reply.send(response);
    });
}
