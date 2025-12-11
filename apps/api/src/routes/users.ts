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
    restaurantId: z.string().optional().nullable(),
    isActive: z.boolean().optional().default(true),
}).refine(data => {
    if (data.role === UserRole.CHEF_DE_COZINHA && !data.restaurantId) {
        return false;
    }
    return true;
}, {
    message: "Restaurante é obrigatório para o cargo de Chef de Cozinha",
    path: ["restaurantId"]
});

// Schema for updating a user
const updateUserSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.nativeEnum(UserRole).optional(),
    restaurantId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(), // Optional reset
}).refine(data => {
    if (data.role === UserRole.CHEF_DE_COZINHA && !data.restaurantId) {
        // Only if role IS explicitly being set to Chef, OR if it's already Chef (handled in logic later, but Zod checks payload)
        // If payload has role=Chef, it MUST have restaurantId.
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
        preHandler: [requireDiretor],
    }, async (request, reply) => {
        const { search, role, status, restaurantId } = request.query as { search?: string, role?: UserRole, status?: string, restaurantId?: string };

        const where: any = {};

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
            where.restaurantId = restaurantId;
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
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const response: ApiResponse = {
            success: true,
            data: users,
        };

        return reply.send(response);
    });

    // POST / - Create User
    fastify.post('/', {
        preHandler: [requireDiretor],
    }, async (request, reply) => {
        const body = createUserSchema.parse(request.body);

        // Check unique email
        const existing = await prisma.user.findUnique({ where: { email: body.email } });
        if (existing) {
            throw errors.conflict('Email já cadastrado');
        }

        const passwordHash = await bcrypt.hash(body.password, 10);

        const user = await prisma.user.create({
            data: {
                email: body.email,
                firstName: body.firstName,
                lastName: body.lastName,
                passwordHash,
                role: body.role,
                isActive: body.isActive ?? true,
                // Enforce creator's restaurant context if it exists (Organization inheritance)
                restaurantId: request.user?.restaurantId || body.restaurantId || null,
            }
        });

        // Audit log could go here

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
        preHandler: [requireDiretor],
    }, async (request, reply) => {
        const { id } = request.params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                restaurantId: true,
                restaurant: { select: { id: true, name: true } }
            }
        });

        if (!user) {
            throw errors.notFound('Usuário não encontrado');
        }

        const response: ApiResponse = {
            success: true,
            data: user,
        };

        return reply.send(response);
    });

    // PUT /:id - Update User
    fastify.put<{ Params: { id: string } }>('/:id', {
        preHandler: [requireDiretor],
    }, async (request, reply) => {
        const { id } = request.params;
        const body = updateUserSchema.parse(request.body);

        const currentUser = await prisma.user.findUnique({ where: { id } });
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

        // Validate Chef Logic if only one field is changing/partial updates
        const nextRole = body.role || currentUser.role;
        const nextRestaurantId = body.restaurantId !== undefined ? body.restaurantId : currentUser.restaurantId;

        if (nextRole === UserRole.CHEF_DE_COZINHA && !nextRestaurantId) {
            throw errors.badRequest('Obrigatório informar restaurante para Chef de Cozinha');
        }

        // Prevent locking out all Directors (Last Director check)
        if (currentUser.role === UserRole.DIRETOR && body.role && body.role !== UserRole.DIRETOR) {
            const directorCount = await prisma.user.count({
                where: { role: UserRole.DIRETOR, isActive: true }
            });
            if (directorCount <= 1) {
                throw errors.badRequest('Não é possível remover o último Diretor ativo do sistema.');
            }
        }

        const dataToUpdate: any = {
            ...body,
            restaurantId: nextRole === UserRole.CHEF_DE_COZINHA ? nextRestaurantId : (body.restaurantId === undefined ? undefined : body.restaurantId), // If changing role away from Chef, we might want to allow nulling restaurantId or keep it. 
        };

        // If password provided
        if (body.password) {
            dataToUpdate.passwordHash = await bcrypt.hash(body.password, 10);
            delete dataToUpdate.password;
        }

        // Clean up ID mismatch if role changed
        if (body.role && body.role !== UserRole.CHEF_DE_COZINHA && dataToUpdate.restaurantId === undefined) {
            // If not chef, we allow restaurantId to be whatever, or maybe strict clear? 
            // "Opcional/Null para os demais cargos". Let's explicitly allow clearing it if passed as null, ensuring schema handles "undefined" aka no change vs "null" clear.
            // Zod .optional().nullable() allows null. 
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: dataToUpdate,
        });

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
