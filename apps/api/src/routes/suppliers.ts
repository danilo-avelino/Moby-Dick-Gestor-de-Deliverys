import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const createSupplierSchema = z.object({
    name: z.string().min(2),
    tradeName: z.string().optional(),
    cnpj: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
});

export async function supplierRoutes(fastify: FastifyInstance) {
    // List suppliers
    fastify.get<{ Querystring: { search?: string; isActive?: string } }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Suppliers'],
            summary: 'List suppliers',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = {
            restaurantId: request.user!.restaurantId,
        };

        if (request.query.search) {
            where.OR = [
                { name: { contains: request.query.search, mode: 'insensitive' } },
                { tradeName: { contains: request.query.search, mode: 'insensitive' } },
                { cnpj: { contains: request.query.search } },
            ];
        }

        if (request.query.isActive !== undefined) {
            where.isActive = request.query.isActive === 'true';
        }

        const suppliers = await prisma.supplier.findMany({
            where,
            include: {
                _count: { select: { products: true, movements: true } },
            },
            orderBy: { name: 'asc' },
        });

        const response: ApiResponse = {
            success: true,
            data: suppliers,
        };

        return reply.send(response);
    });

    // Get supplier
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Suppliers'],
            summary: 'Get supplier by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const supplier = await prisma.supplier.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
            include: {
                products: {
                    select: { id: true, name: true, sku: true, lastPurchasePrice: true },
                    take: 20,
                },
                movements: {
                    where: { type: 'IN' },
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        product: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!supplier) {
            throw errors.notFound('Supplier not found');
        }

        const response: ApiResponse = {
            success: true,
            data: supplier,
        };

        return reply.send(response);
    });

    // Create supplier
    fastify.post('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Suppliers'],
            summary: 'Create supplier',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createSupplierSchema.parse(request.body);

        const supplier = await prisma.supplier.create({
            data: {
                ...body,
                restaurantId: request.user!.restaurantId!,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: supplier,
        };

        return reply.status(201).send(response);
    });

    // Update supplier
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Suppliers'],
            summary: 'Update supplier',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createSupplierSchema.partial().extend({
            isActive: z.boolean().optional(),
            rating: z.number().min(0).max(5).optional(),
        }).parse(request.body);

        const existing = await prisma.supplier.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!existing) {
            throw errors.notFound('Supplier not found');
        }

        const supplier = await prisma.supplier.update({
            where: { id: request.params.id },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: supplier,
        };

        return reply.send(response);
    });

    // Delete supplier
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Suppliers'],
            summary: 'Delete supplier',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const existing = await prisma.supplier.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
            include: {
                _count: { select: { products: true } },
            },
        });

        if (!existing) {
            throw errors.notFound('Supplier not found');
        }

        if (existing._count.products > 0) {
            throw errors.conflict('Supplier has products. Deactivate instead.');
        }

        await prisma.supplier.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Supplier deleted successfully' },
        };

        return reply.send(response);
    });
}
