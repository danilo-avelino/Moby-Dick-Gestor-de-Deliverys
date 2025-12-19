import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

// Schemas
const createOrderSchema = z.object({
    orderType: z.enum(['DELIVERY', 'RETIRADA', 'SALAO']),
    salesChannel: z.enum(['PRESENCIAL', 'SITE', 'WHATSAPP', 'IFOOD', 'RAPPI', 'UBER_EATS', 'APP_PROPRIO']).default('PRESENCIAL'),
    customerId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    addressId: z.string().optional(),
    deliveryAddressText: z.string().optional(),
    deliveryFee: z.number().min(0).default(0),
    tableId: z.string().optional(),
    serviceFeePercent: z.number().min(0).max(100).default(0),
    notes: z.string().optional(),
    kitchenNotes: z.string().optional(),
    items: z.array(z.object({
        productId: z.string().optional(),
        recipeId: z.string().optional(),
        productName: z.string(),
        productSku: z.string().optional(),
        quantity: z.number().positive(),
        unit: z.string().default('un'),
        unitPrice: z.number().min(0),
        notes: z.string().optional(),
        additionals: z.array(z.object({
            name: z.string(),
            price: z.number(),
        })).optional(),
    })).min(1),
});

const updateStatusSchema = z.object({
    status: z.enum(['NOVO', 'EM_PREPARO', 'PRONTO', 'EM_ENTREGA', 'CONCLUIDO', 'CANCELADO']),
    notes: z.string().optional(),
});

// Helper to generate sequential order code
async function generateOrderCode(restaurantId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.pdvOrder.count({
        where: {
            restaurantId,
            createdAt: { gte: today },
        },
    });

    return String(count + 1).padStart(3, '0');
}

export async function pdvOrdersRoutes(fastify: FastifyInstance) {
    // Get recent orders (real-time dashboard)
    fastify.get<{
        Querystring: {
            limit?: string;
            status?: string;
            type?: string;
        };
    }>('/recent', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Get recent orders for dashboard',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);

        const where: any = {};

        // STRICT MULTI-TENANCY FILTER
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        } else if (request.user?.organizationId) {
            where.restaurant = { organizationId: request.user.organizationId };
        } else {
            return reply.send({ success: true, data: [] });
        }

        if (request.query.status) {
            where.status = request.query.status;
        }

        if (request.query.type) {
            where.orderType = request.query.type;
        }

        const orders = await prisma.pdvOrder.findMany({
            where,
            include: {
                items: true,
                payments: true,
                customer: { select: { id: true, name: true, phone: true } },
                table: { select: { id: true, identifier: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        const response: ApiResponse = {
            success: true,
            data: orders.map(o => ({
                ...o,
                createdAt: o.createdAt.toISOString(),
                updatedAt: o.updatedAt.toISOString(),
            })),
        };

        return reply.send(response);
    });

    // List orders with pagination and filters
    fastify.get<{
        Querystring: {
            page?: string;
            limit?: string;
            status?: string;
            type?: string;
            channel?: string;
            startDate?: string;
            endDate?: string;
            search?: string;
        };
    }>('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'List orders with pagination',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = {};

        // STRICT MULTI-TENANCY FILTER
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        } else if (request.user?.organizationId) {
            where.restaurant = { organizationId: request.user.organizationId };
        } else {
            // Return empty pagination
            return reply.send({
                success: true,
                data: {
                    data: [],
                    pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
                }
            });
        }

        if (request.query.status) {
            where.status = request.query.status;
        }

        if (request.query.type) {
            where.orderType = request.query.type;
        }

        if (request.query.channel) {
            where.salesChannel = request.query.channel;
        }

        if (request.query.startDate) {
            where.createdAt = { ...where.createdAt, gte: new Date(request.query.startDate) };
        }

        if (request.query.endDate) {
            where.createdAt = { ...where.createdAt, lte: new Date(request.query.endDate) };
        }

        if (request.query.search) {
            where.OR = [
                { code: { contains: request.query.search, mode: 'insensitive' } },
                { customerName: { contains: request.query.search, mode: 'insensitive' } },
                { customerPhone: { contains: request.query.search, mode: 'insensitive' } },
            ];
        }

        const [orders, total] = await Promise.all([
            prisma.pdvOrder.findMany({
                where,
                include: {
                    items: true,
                    payments: { select: { method: true, amount: true, status: true } },
                    customer: { select: { id: true, name: true } },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.pdvOrder.count({ where }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                data: orders.map(o => ({
                    ...o,
                    createdAt: o.createdAt.toISOString(),
                    updatedAt: o.updatedAt.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1,
                },
            },
        };

        return reply.send(response);
    });

    // Get single order
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Get order by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const order = await prisma.pdvOrder.findFirst({
            where,
            include: {
                items: true,
                payments: true,
                statusHistory: {
                    include: {
                        changedBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                customer: true,
                address: true,
                table: true,
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        if (!order) {
            throw errors.notFound('Order not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...order,
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Create order
    fastify.post('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Create new order',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createOrderSchema.parse(request.body);
        const restaurantId = request.user!.costCenterId!;

        // Generate order code
        const code = await generateOrderCode(restaurantId);

        // Calculate totals
        let subtotal = 0;
        const itemsData = body.items.map(item => {
            const additionalsTotal = item.additionals?.reduce((sum, a) => sum + a.price, 0) || 0;
            const totalPrice = (item.unitPrice + additionalsTotal) * item.quantity;
            subtotal += totalPrice;

            return {
                productId: item.productId,
                recipeId: item.recipeId,
                productName: item.productName,
                productSku: item.productSku,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                totalPrice,
                notes: item.notes,
                additionals: item.additionals ? JSON.stringify(item.additionals) : null,
                additionalsTotal,
            };
        });

        // Calculate service fee for SALAO
        const serviceFee = body.orderType === 'SALAO' && body.serviceFeePercent > 0
            ? subtotal * (body.serviceFeePercent / 100)
            : 0;

        const total = subtotal + body.deliveryFee + serviceFee;

        // Get table identifier if tableId provided
        let tableIdentifier: string | undefined;
        if (body.tableId) {
            const table = await prisma.restaurantTable.findUnique({
                where: { id: body.tableId },
                select: { identifier: true },
            });
            tableIdentifier = table?.identifier;
        }

        // Create order with items in transaction
        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.pdvOrder.create({
                data: {
                    code,
                    restaurantId,
                    orderType: body.orderType as any,
                    salesChannel: body.salesChannel as any,
                    customerId: body.customerId,
                    customerName: body.customerName,
                    customerPhone: body.customerPhone,
                    addressId: body.addressId,
                    deliveryAddressText: body.deliveryAddressText,
                    deliveryFee: body.deliveryFee,
                    tableId: body.tableId,
                    tableIdentifier,
                    serviceFee,
                    serviceFeePercent: body.serviceFeePercent,
                    subtotal,
                    total,
                    notes: body.notes,
                    kitchenNotes: body.kitchenNotes,
                    createdByUserId: request.user!.id,
                    items: {
                        create: itemsData.map(item => ({
                            ...item,
                            additionals: item.additionals ? JSON.parse(item.additionals) : undefined,
                        })),
                    },
                },
                include: {
                    items: true,
                },
            });

            // Create initial status history
            await tx.pdvOrderStatusHistory.create({
                data: {
                    orderId: newOrder.id,
                    toStatus: 'NOVO',
                    changedById: request.user!.id,
                },
            });

            // Update table status if SALAO
            if (body.tableId) {
                await tx.restaurantTable.update({
                    where: { id: body.tableId },
                    data: {
                        status: 'OCUPADA',
                        currentOrderId: newOrder.id,
                    },
                });
            }

            return newOrder;
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...order,
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update order status
    fastify.patch<{ Params: { id: string } }>('/:id/status', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Update order status',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = updateStatusSchema.parse(request.body);

        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const order = await prisma.pdvOrder.findFirst({ where });

        if (!order) {
            throw errors.notFound('Order not found');
        }

        // Validate status transition
        const validTransitions: Record<string, string[]> = {
            'NOVO': ['EM_PREPARO', 'CANCELADO'],
            'EM_PREPARO': ['PRONTO', 'CANCELADO'],
            'PRONTO': ['EM_ENTREGA', 'CONCLUIDO', 'CANCELADO'],
            'EM_ENTREGA': ['CONCLUIDO', 'CANCELADO'],
            'CONCLUIDO': [],
            'CANCELADO': [],
        };

        if (!validTransitions[order.status]?.includes(body.status)) {
            throw errors.badRequest(`Cannot change status from ${order.status} to ${body.status}`);
        }

        // Update with additional fields based on status
        const updateData: any = {
            status: body.status,
        };

        if (body.status === 'PRONTO') {
            updateData.readyAt = new Date();
        } else if (body.status === 'CONCLUIDO') {
            updateData.deliveredAt = new Date();
        }

        const [updatedOrder] = await prisma.$transaction([
            prisma.pdvOrder.update({
                where: { id: order.id },
                data: updateData,
                include: {
                    items: true,
                    payments: true,
                },
            }),
            prisma.pdvOrderStatusHistory.create({
                data: {
                    orderId: order.id,
                    fromStatus: order.status as any,
                    toStatus: body.status as any,
                    notes: body.notes,
                    changedById: request.user!.id,
                },
            }),
        ]);

        // Free table if SALAO and completed/cancelled
        if (order.tableId && ['CONCLUIDO', 'CANCELADO'].includes(body.status)) {
            await prisma.restaurantTable.update({
                where: { id: order.tableId },
                data: {
                    status: 'LIVRE',
                    currentOrderId: null,
                },
            });
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...updatedOrder,
                createdAt: updatedOrder.createdAt.toISOString(),
                updatedAt: updatedOrder.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Add item to existing order
    fastify.post<{ Params: { id: string } }>('/:id/items', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Add item to order',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const itemSchema = z.object({
            productId: z.string().optional(),
            recipeId: z.string().optional(),
            productName: z.string(),
            productSku: z.string().optional(),
            quantity: z.number().positive(),
            unit: z.string().default('un'),
            unitPrice: z.number().min(0),
            notes: z.string().optional(),
            additionals: z.array(z.object({
                name: z.string(),
                price: z.number(),
            })).optional(),
        });

        const body = itemSchema.parse(request.body);

        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const order = await prisma.pdvOrder.findFirst({ where });

        if (!order) {
            throw errors.notFound('Order not found');
        }

        // Only allow adding items to orders not yet completed
        if (['CONCLUIDO', 'CANCELADO'].includes(order.status)) {
            throw errors.badRequest('Cannot add items to completed or cancelled orders');
        }

        const additionalsTotal = body.additionals?.reduce((sum, a) => sum + a.price, 0) || 0;
        const totalPrice = (body.unitPrice + additionalsTotal) * body.quantity;

        const [item] = await prisma.$transaction([
            prisma.pdvOrderItem.create({
                data: {
                    orderId: order.id,
                    productId: body.productId,
                    recipeId: body.recipeId,
                    productName: body.productName,
                    productSku: body.productSku,
                    quantity: body.quantity,
                    unit: body.unit,
                    unitPrice: body.unitPrice,
                    totalPrice,
                    notes: body.notes,
                    additionals: body.additionals,
                    additionalsTotal,
                },
            }),
            prisma.pdvOrder.update({
                where: { id: order.id },
                data: {
                    subtotal: order.subtotal + totalPrice,
                    total: order.total + totalPrice,
                },
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: item,
        };

        return reply.status(201).send(response);
    });

    // Get order statistics
    fastify.get('/stats/summary', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Get PDV statistics',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const restaurantId = request.user?.costCenterId;

        if (!restaurantId) {
            // Stats require restaurant context (or aggressive aggregation logic which is complex)
            // For now return zeros if no restaurant context
            return reply.send({
                success: true,
                data: {
                    todayOrders: 0,
                    todayRevenue: 0,
                    byStatus: {},
                    byType: {}
                }
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const where: any = {
            createdAt: { gte: today },
            restaurantId: restaurantId
        };

        const [
            todayOrders,
            todayRevenue,
            byStatus,
            byType,
        ] = await Promise.all([
            prisma.pdvOrder.count({ where }),
            prisma.pdvOrder.aggregate({
                where: { ...where, status: 'CONCLUIDO' },
                _sum: { total: true },
            }),
            prisma.pdvOrder.groupBy({
                by: ['status'],
                where,
                _count: true,
            }),
            prisma.pdvOrder.groupBy({
                by: ['orderType'],
                where,
                _count: true,
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                todayOrders,
                todayRevenue: todayRevenue._sum.total || 0,
                byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
                byType: Object.fromEntries(byType.map(t => [t.orderType, t._count])),
            },
        };

        return reply.send(response);
    });
}
