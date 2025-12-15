import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const createCustomerSchema = z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional().nullable(),
    cpf: z.string().optional(),
    notes: z.string().optional(),
});

const createAddressSchema = z.object({
    label: z.string().optional(),
    street: z.string().min(1),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2).max(2),
    zipCode: z.string().min(8).max(9),
    reference: z.string().optional(),
    isDefault: z.boolean().default(false),
});

export async function customersRoutes(fastify: FastifyInstance) {
    // Search/list customers
    fastify.get<{
        Querystring: {
            search?: string;
            page?: string;
            limit?: string;
        };
    }>('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Search customers',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = { isActive: true };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        if (request.query.search) {
            where.OR = [
                { name: { contains: request.query.search, mode: 'insensitive' } },
                { phone: { contains: request.query.search } },
                { email: { contains: request.query.search, mode: 'insensitive' } },
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                include: {
                    addresses: { where: { isDefault: true }, take: 1 },
                    _count: { select: { orders: true } },
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.customer.count({ where }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                data: customers.map(c => ({
                    ...c,
                    createdAt: c.createdAt.toISOString(),
                    updatedAt: c.updatedAt.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        };

        return reply.send(response);
    });

    // Get customer by ID
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Get customer details',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const customer = await prisma.customer.findFirst({
            where,
            include: {
                addresses: { orderBy: { isDefault: 'desc' } },
                orders: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        code: true,
                        total: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!customer) {
            throw errors.notFound('Customer not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...customer,
                createdAt: customer.createdAt.toISOString(),
                updatedAt: customer.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Create customer
    fastify.post('/', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Create customer',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createCustomerSchema.parse(request.body);

        const customer = await prisma.customer.create({
            data: {
                restaurantId: request.user!.costCenterId!,
                ...body,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...customer,
                createdAt: customer.createdAt.toISOString(),
                updatedAt: customer.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update customer
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Update customer',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createCustomerSchema.partial().parse(request.body);

        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const existing = await prisma.customer.findFirst({ where });
        if (!existing) {
            throw errors.notFound('Customer not found');
        }

        const customer = await prisma.customer.update({
            where: { id: existing.id },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...customer,
                createdAt: customer.createdAt.toISOString(),
                updatedAt: customer.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Add address to customer
    fastify.post<{ Params: { id: string } }>('/:id/addresses', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Add address to customer',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createAddressSchema.parse(request.body);

        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const customer = await prisma.customer.findFirst({ where });
        if (!customer) {
            throw errors.notFound('Customer not found');
        }

        // If setting as default, unset other defaults
        if (body.isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerId: customer.id },
                data: { isDefault: false },
            });
        }

        const address = await prisma.customerAddress.create({
            data: {
                customerId: customer.id,
                ...body,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...address,
                createdAt: address.createdAt.toISOString(),
                updatedAt: address.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update address
    fastify.patch<{ Params: { id: string; addressId: string } }>('/:id/addresses/:addressId', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Update customer address',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createAddressSchema.partial().parse(request.body);

        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const customer = await prisma.customer.findFirst({ where });
        if (!customer) {
            throw errors.notFound('Customer not found');
        }

        const address = await prisma.customerAddress.findFirst({
            where: { id: request.params.addressId, customerId: customer.id },
        });

        if (!address) {
            throw errors.notFound('Address not found');
        }

        // If setting as default, unset other defaults
        if (body.isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerId: customer.id, id: { not: address.id } },
                data: { isDefault: false },
            });
        }

        const updated = await prisma.customerAddress.update({
            where: { id: address.id },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...updated,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Delete address
    fastify.delete<{ Params: { id: string; addressId: string } }>('/:id/addresses/:addressId', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV - Clientes'],
            summary: 'Delete customer address',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const customer = await prisma.customer.findFirst({ where });
        if (!customer) {
            throw errors.notFound('Customer not found');
        }

        await prisma.customerAddress.deleteMany({
            where: { id: request.params.addressId, customerId: customer.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Address deleted' },
        };

        return reply.send(response);
    });
}
