import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const createCategorySchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    parentId: z.string().optional(),
    sortOrder: z.number().optional(),
});

export async function categoryRoutes(fastify: FastifyInstance) {
    // List categories (tree structure)
    fastify.get('/', {
        preHandler: [authenticate],
        schema: {
            tags: ['Categories'],
            summary: 'List categories',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const categories = await prisma.productCategory.findMany({
            where: {
                organizationId: request.user!.organizationId!,
                parentId: null, // Only root categories
            },
            include: {
                children: {
                    include: {
                        children: true,
                        _count: { select: { products: true } },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
                _count: { select: { products: true } },
            },
            orderBy: { sortOrder: 'asc' },
        });

        const response: ApiResponse = {
            success: true,
            data: categories,
        };

        return reply.send(response);
    });

    // Get flat list of categories
    fastify.get('/flat', {
        preHandler: [authenticate],
        schema: {
            tags: ['Categories'],
            summary: 'List categories (flat)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const categories = await prisma.productCategory.findMany({
            where: {
                organizationId: request.user!.organizationId!,
            },
            include: {
                _count: { select: { products: true, recipes: true } },
            },
            orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        });

        const response: ApiResponse = {
            success: true,
            data: categories,
        };

        return reply.send(response);
    });

    // Create category
    fastify.post('/', {
        preHandler: [authenticate],
        schema: {
            tags: ['Categories'],
            summary: 'Create category',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createCategorySchema.parse(request.body);

        // If parent specified, verify it exists
        if (body.parentId) {
            const parent = await prisma.productCategory.findFirst({
                where: {
                    id: body.parentId,
                    organizationId: request.user!.organizationId!,
                },
            });
            if (!parent) {
                throw errors.notFound('Parent category not found');
            }
        }

        const category = await prisma.productCategory.create({
            data: {
                ...body,
                organizationId: request.user!.organizationId!,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: category,
        };

        return reply.status(201).send(response);
    });

    // Update category
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [authenticate],
        schema: {
            tags: ['Categories'],
            summary: 'Update category',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createCategorySchema.partial().parse(request.body);

        const existing = await prisma.productCategory.findFirst({
            where: {
                id: request.params.id,
                organizationId: request.user!.organizationId!,
            },
        });

        if (!existing) {
            throw errors.notFound('Category not found');
        }

        // Prevent circular reference
        if (body.parentId === request.params.id) {
            throw errors.badRequest('Category cannot be its own parent');
        }

        const category = await prisma.productCategory.update({
            where: { id: request.params.id },
            data: body,
        });

        const response: ApiResponse = {
            success: true,
            data: category,
        };

        return reply.send(response);
    });

    // Delete category
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [authenticate],
        schema: {
            tags: ['Categories'],
            summary: 'Delete category',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const existing = await prisma.productCategory.findFirst({
            where: {
                id: request.params.id,
                organizationId: request.user!.organizationId!,
            },
            include: {
                _count: { select: { products: true, children: true } },
            },
        });

        if (!existing) {
            throw errors.notFound('Category not found');
        }

        if (existing._count.products > 0) {
            throw errors.conflict('Category has products. Move them first.');
        }

        if (existing._count.children > 0) {
            throw errors.conflict('Category has subcategories. Delete them first.');
        }

        await prisma.productCategory.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Category deleted successfully' },
        };

        return reply.send(response);
    });
}
