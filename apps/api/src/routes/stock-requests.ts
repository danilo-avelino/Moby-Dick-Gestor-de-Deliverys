import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { UserRole, ApiResponse } from 'types';

// --- Schemas ---

const createRequestSchema = z.object({
    shift: z.enum(['DAY', 'NIGHT'], { required_error: 'O turno é obrigatório' }),
    chefObservation: z.string().optional(),
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().positive('A quantidade deve ser maior que zero'),
        notes: z.string().optional(),
    })).min(1, 'Adicione pelo menos um item à requisição'),
});

const approveRequestSchema = z.object({
    items: z.array(z.object({
        itemId: z.string(),
        quantityApproved: z.number().nonnegative('A quantidade aprovada não pode ser negativa'),
    })),
    comment: z.string().optional(),
});

const rejectRequestSchema = z.object({
    reason: z.string().min(1, 'A justificativa é obrigatória'),
});

const commentSchema = z.object({
    message: z.string().min(1, 'O comentário não pode estar vazio'),
});

const templateSchema = z.object({
    name: z.string().optional(),
    shift: z.enum(['DAY', 'NIGHT']).optional(),
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().optional(),
    })),
});

// --- Helpers ---

const canCreateRequest = (role: UserRole) => {
    return [UserRole.CHEF_DE_COZINHA, UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(role);
};

const canApproveRequest = (role: UserRole) => {
    return [UserRole.ESTOQUE, UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(role);
};

export async function stockRequestRoutes(fastify: FastifyInstance) {

    // GET / - List Requests
    fastify.get('/', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { role, id: userId, restaurantId } = request.user!;

        const whereClause: any = { restaurantId };

        // Chef sees only their own requests
        if (role === UserRole.CHEF_DE_COZINHA) {
            whereClause.createdByUserId = userId;
        }

        const requests = await prisma.stockRequest.findMany({
            where: whereClause,
            include: {
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        const response: ApiResponse = {
            success: true,
            data: requests,
        };

        return reply.send(response);
    });

    // GET /:id - Request Details
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id } = request.params;
        const { role, restaurantId, id: userId } = request.user!;

        const stockRequest = await prisma.stockRequest.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                baseUnit: true,
                                currentStock: true,
                                reorderPoint: true,
                            }
                        }
                    }
                },
                comments: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, role: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                createdBy: { select: { id: true, firstName: true, lastName: true, role: true, restaurant: { select: { name: true } } } },
                approvedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
            }
        });

        if (!stockRequest || stockRequest.restaurantId !== restaurantId) {
            throw errors.notFound('Requisição não encontrada');
        }

        // Access Rule: Chef limits
        if (role === UserRole.CHEF_DE_COZINHA && stockRequest.createdByUserId !== userId) {
            throw errors.forbidden('Você só pode visualizar suas próprias requisições');
        }

        // Security: Mask stock for sensitive roles
        const shouldHideStock = role === UserRole.ESTOQUE;

        if (shouldHideStock) {
            stockRequest.items.forEach((item: any) => {
                if (item.product) {
                    item.product.currentStock = null;
                    item.product.reorderPoint = null;
                }
            });
        }

        const response: ApiResponse = {
            success: true,
            data: stockRequest,
        };

        return reply.send(response);
    });

    // POST / - Create Request
    fastify.post('/', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { role, restaurantId, id: userId } = request.user!;

        if (!canCreateRequest(role)) {
            throw errors.forbidden('Seu perfil não tem permissão para criar requisições');
        }

        const body = createRequestSchema.parse(request.body);

        // Verify products existence and validity
        const productIds = body.items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                restaurantId: restaurantId!,
            }
        });

        if (products.length !== productIds.length) {
            throw errors.badRequest('Alguns produtos da lista não foram encontrados no sistema');
        }

        if (body.items.some(i => i.quantity <= 0)) {
            throw errors.badRequest('A quantidade solicitada deve ser maior que zero');
        }

        const productMap = new Map(products.map(p => [p.id, p]));
        const code = `REQ-${Date.now().toString().slice(-6)}`;

        const stockRequest = await prisma.stockRequest.create({
            data: {
                code,
                restaurantId: restaurantId!,
                createdByUserId: userId,
                shift: body.shift,
                chefObservation: body.chefObservation,
                status: 'PENDING',
                items: {
                    create: body.items.map(item => {
                        const product = productMap.get(item.productId)!;
                        return {
                            productId: item.productId,
                            quantityRequested: item.quantity,
                            productNameSnapshot: product.name,
                            unitSnapshot: product.baseUnit,
                            notes: item.notes,
                        };
                    })
                },
                comments: body.chefObservation ? {
                    create: {
                        userId: userId,
                        message: `OBSERVAÇÃO INICIAL: ${body.chefObservation}`,
                    }
                } : undefined,
            }
        });

        const response: ApiResponse = {
            success: true,
            data: stockRequest,
        };

        return reply.status(201).send(response);
    });

    // PUT /:id - Update Request
    fastify.put<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id } = request.params;
        const { role, restaurantId, id: userId } = request.user!;

        const existingRequest = await prisma.stockRequest.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!existingRequest || existingRequest.restaurantId !== restaurantId) {
            throw errors.notFound('Requisição não encontrada');
        }

        if (existingRequest.status !== 'PENDING') {
            throw errors.badRequest('Apenas requisições pendentes podem ser editadas');
        }

        if (role === UserRole.CHEF_DE_COZINHA && existingRequest.createdByUserId !== userId) {
            throw errors.forbidden('Você só pode editar suas próprias requisições');
        }

        const body = createRequestSchema.parse(request.body);

        // Verify products existence
        const productIds = body.items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                restaurantId: restaurantId!,
            }
        });

        if (products.length !== productIds.length) {
            throw errors.badRequest('Alguns produtos da lista não foram encontrados no sistema');
        }

        if (body.items.some(i => i.quantity <= 0)) {
            throw errors.badRequest('A quantidade solicitada deve ser maior que zero');
        }

        const productMap = new Map(products.map(p => [p.id, p]));

        // Transactional Update
        await prisma.$transaction(async (tx) => {
            await tx.stockRequestItem.deleteMany({
                where: { stockRequestId: id }
            });

            await tx.stockRequest.update({
                where: { id },
                data: {
                    chefObservation: body.chefObservation,
                    items: {
                        create: body.items.map(item => {
                            const product = productMap.get(item.productId)!;
                            return {
                                productId: item.productId,
                                quantityRequested: item.quantity,
                                productNameSnapshot: product.name,
                                unitSnapshot: product.baseUnit,
                                notes: item.notes,
                            };
                        })
                    }
                }
            });
        });

        return reply.send({ success: true, message: 'Requisição atualizada com sucesso' });
    });

    // POST /:id/approve - Approve Request
    fastify.post<{ Params: { id: string } }>('/:id/approve', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id } = request.params;
        const { role, restaurantId, id: userId } = request.user!;

        if (!canApproveRequest(role)) {
            throw errors.forbidden('Apenas Estoque ou Diretoria podem aprovar requisições');
        }

        const body = approveRequestSchema.parse(request.body);

        await prisma.$transaction(async (tx) => {
            const stockRequest = await tx.stockRequest.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!stockRequest || stockRequest.restaurantId !== restaurantId) {
                throw errors.notFound('Requisição não encontrada');
            }

            if (stockRequest.status !== 'PENDING') {
                throw errors.badRequest('Esta requisição já foi processada');
            }

            if (body.comment) {
                await tx.stockRequestComment.create({
                    data: {
                        stockRequestId: id,
                        userId: userId,
                        message: body.comment,
                    }
                });
            }

            // Validate and Deduct Stock
            for (const item of stockRequest.items) {
                const approvedItem = body.items.find(i => i.itemId === item.id);
                const quantityToApprove = approvedItem ? approvedItem.quantityApproved : item.quantityRequested;

                if (quantityToApprove <= 0) continue;

                const product = await tx.product.findUnique({ where: { id: item.productId } });

                if (!product) throw errors.badRequest(`Produto original do item não encontrado (ID: ${item.productId})`);

                if (product.currentStock < quantityToApprove) {
                    const msg = role === UserRole.ESTOQUE
                        ? `Estoque insuficiente para o item "${product.name}". Verifique o saldo disponível.`
                        : `Estoque insuficiente para "${product.name}". (Solicitado/Aprovado: ${quantityToApprove}, Atual: ${product.currentStock})`;

                    throw errors.badRequest(msg);
                }

                await tx.stockRequestItem.update({
                    where: { id: item.id },
                    data: { quantityApproved: quantityToApprove }
                });

                const newStock = product.currentStock - quantityToApprove;
                await tx.product.update({
                    where: { id: product.id },
                    data: { currentStock: newStock }
                });

                await tx.stockMovement.create({
                    data: {
                        productId: product.id,
                        type: 'OUT',
                        quantity: quantityToApprove,
                        unit: product.baseUnit,
                        costPerUnit: product.avgCost,
                        totalCost: quantityToApprove * product.avgCost,
                        stockBefore: product.currentStock,
                        stockAfter: newStock,
                        referenceType: 'TRANSFER',
                        userId: userId,
                        notes: `Requisição ${stockRequest.code} - Aprovada`
                    }
                });
            }

            await tx.stockRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                    approvedByUserId: userId,
                }
            });
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Requisição aprovada com sucesso' },
        };

        return reply.send(response);
    });

    // POST /:id/reject - Reject Request
    fastify.post<{ Params: { id: string } }>('/:id/reject', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id } = request.params;
        const { role, id: userId, restaurantId } = request.user!;
        const body = rejectRequestSchema.parse(request.body);

        if (!canApproveRequest(role)) {
            throw errors.forbidden('Você não tem permissão para rejeitar requisições');
        }

        const stockRequest = await prisma.stockRequest.findUnique({
            where: { id },
        });

        if (!stockRequest || stockRequest.restaurantId !== restaurantId) {
            throw errors.notFound('Requisição não encontrada');
        }

        if (stockRequest.status !== 'PENDING') {
            throw errors.badRequest('Esta requisição já foi processada');
        }

        await prisma.$transaction(async (tx) => {
            await tx.stockRequestComment.create({
                data: {
                    stockRequestId: id,
                    userId: userId,
                    message: `REJEITADO: ${body.reason}`,
                }
            });

            await tx.stockRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    rejectedAt: new Date(),
                    rejectedByUserId: userId,
                }
            });
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Requisição rejeitada' },
        };

        return reply.send(response);
    });

    // POST /:id/comments - Add Comment
    fastify.post<{ Params: { id: string } }>('/:id/comments', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id } = request.params;
        const { id: userId, restaurantId } = request.user!;
        const body = commentSchema.parse(request.body);

        const stockRequest = await prisma.stockRequest.findUnique({
            where: { id },
        });

        if (!stockRequest || stockRequest.restaurantId !== restaurantId) {
            throw errors.notFound('Requisição não encontrada');
        }

        const comment = await prisma.stockRequestComment.create({
            data: {
                stockRequestId: id,
                userId: userId,
                message: body.message,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, role: true } }
            }
        });

        const response: ApiResponse = {
            success: true,
            data: comment,
        };

        return reply.send(response);
    });

    // GET /template - Get Template
    fastify.get<{ Querystring: { shift?: 'DAY' | 'NIGHT' } }>('/template', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id: userId, restaurantId } = request.user!;
        const { shift } = request.query;

        if (!restaurantId) throw errors.forbidden('Restaurante não identificado');

        const template = await prisma.stockRequestTemplate.findFirst({
            where: {
                restaurantId,
                createdByUserId: userId,
                ...(shift ? { shift } : {}),
            },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, baseUnit: true, sku: true } }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const response: ApiResponse = {
            success: true,
            data: template,
        };

        return reply.send(response);
    });

    // POST /template - Save Template
    fastify.post('/template', {
        preHandler: [requireRestaurant],
    }, async (request, reply) => {
        const { id: userId, restaurantId } = request.user!;
        const body = templateSchema.parse(request.body);

        if (!restaurantId) throw errors.forbidden('Restaurante não identificado');

        const shift = body.shift || 'DAY';

        const existing = await prisma.stockRequestTemplate.findFirst({
            where: {
                restaurantId,
                createdByUserId: userId,
                shift,
            }
        });

        let template;

        if (existing) {
            await prisma.$transaction(async (tx) => {
                await tx.stockRequestTemplateItem.deleteMany({
                    where: { templateId: existing.id }
                });

                if (body.items.length > 0) {
                    await tx.stockRequestTemplateItem.createMany({
                        data: body.items.map(i => ({
                            templateId: existing.id,
                            productId: i.productId,
                            standardQuantity: i.quantity || 0,
                        }))
                    });
                }

                template = await tx.stockRequestTemplate.update({
                    where: { id: existing.id },
                    data: { name: body.name || existing.name, updatedAt: new Date() },
                    include: { items: true }
                });
            });
        } else {
            template = await prisma.stockRequestTemplate.create({
                data: {
                    restaurantId,
                    createdByUserId: userId,
                    name: body.name || `Lista Padrão (${shift === 'DAY' ? 'Dia' : 'Noite'})`,
                    shift,
                    items: {
                        create: body.items.map(i => ({
                            productId: i.productId,
                            standardQuantity: i.quantity || 0,
                        }))
                    }
                },
                include: { items: true }
            });
        }

        const response: ApiResponse = {
            success: true,
            data: template,
        };

        return reply.send(response);
    });
}
