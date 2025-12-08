import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse, PaginatedResponse, ProductDTO } from 'types';

const createProductSchema = z.object({
    sku: z.string().optional(),
    barcode: z.string().optional(),
    name: z.string().min(2),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    baseUnit: z.string().default('un'),
    unitType: z.enum(['WEIGHT', 'VOLUME', 'UNIT', 'LENGTH']).default('UNIT'),
    conversions: z.record(z.number()).optional(),
    minStock: z.number().min(0).default(0),
    maxStock: z.number().min(0).optional(),
    reorderPoint: z.number().min(0).optional(),
    isPerishable: z.boolean().default(false),
    shelfLifeDays: z.number().min(0).optional(),
    defaultSupplierId: z.string().optional(),
    leadTimeDays: z.number().min(0).default(1),
    imageUrl: z.string().url().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export async function productRoutes(fastify: FastifyInstance) {
    // List products
    fastify.get<{
        Querystring: {
            page?: string;
            limit?: string;
            search?: string;
            categoryId?: string;
            isActive?: string;
            lowStock?: string;
        };
    }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'List products',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = {
            restaurantId: request.user!.restaurantId,
        };

        if (request.query.search) {
            where.OR = [
                { name: { contains: request.query.search, mode: 'insensitive' } },
                { sku: { contains: request.query.search, mode: 'insensitive' } },
                { barcode: { contains: request.query.search, mode: 'insensitive' } },
            ];
        }

        if (request.query.categoryId) {
            where.categoryId = request.query.categoryId;
        }

        if (request.query.isActive !== undefined) {
            where.isActive = request.query.isActive === 'true';
        }

        if (request.query.lowStock === 'true') {
            where.currentStock = { lte: prisma.product.fields.minStock };
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: { select: { id: true, name: true } },
                    defaultSupplier: { select: { id: true, name: true } },
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.product.count({ where }),
        ]);

        const response: ApiResponse<PaginatedResponse<ProductDTO>> = {
            success: true,
            data: {
                data: products.map((p) => ({
                    id: p.id,
                    sku: p.sku || undefined,
                    barcode: p.barcode || undefined,
                    name: p.name,
                    description: p.description || undefined,
                    category: p.category || undefined,
                    baseUnit: p.baseUnit,
                    currentStock: p.currentStock,
                    minStock: p.minStock,
                    maxStock: p.maxStock || undefined,
                    avgCost: p.avgCost,
                    lastPurchasePrice: p.lastPurchasePrice,
                    isPerishable: p.isPerishable,
                    shelfLifeDays: p.shelfLifeDays || undefined,
                    defaultSupplier: p.defaultSupplier || undefined,
                    isActive: p.isActive,
                    imageUrl: p.imageUrl || undefined,
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString(),
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

    // Get single product
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Get product by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const product = await prisma.product.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
            include: {
                category: true,
                defaultSupplier: true,
                movements: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                        supplier: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!product) {
            throw errors.notFound('Product not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...product,
                createdAt: product.createdAt.toISOString(),
                updatedAt: product.updatedAt.toISOString(),
                movements: product.movements.map((m) => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
                })),
            },
        };

        return reply.send(response);
    });

    // Create product
    fastify.post('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Create product',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createProductSchema.parse(request.body);

        // Check for duplicate SKU
        if (body.sku) {
            const existing = await prisma.product.findFirst({
                where: {
                    restaurantId: request.user!.restaurantId,
                    sku: body.sku,
                },
            });
            if (existing) {
                throw errors.conflict('SKU already exists');
            }
        }

        const product = await prisma.product.create({
            data: {
                ...body,
                restaurantId: request.user!.restaurantId!,
            },
            include: {
                category: true,
                defaultSupplier: true,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...product,
                createdAt: product.createdAt.toISOString(),
                updatedAt: product.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update product
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Update product',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = updateProductSchema.parse(request.body);

        // Ensure product exists and belongs to restaurant
        const existing = await prisma.product.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!existing) {
            throw errors.notFound('Product not found');
        }

        // Check for duplicate SKU
        if (body.sku && body.sku !== existing.sku) {
            const duplicate = await prisma.product.findFirst({
                where: {
                    restaurantId: request.user!.restaurantId,
                    sku: body.sku,
                    NOT: { id: existing.id },
                },
            });
            if (duplicate) {
                throw errors.conflict('SKU already exists');
            }
        }

        const product = await prisma.product.update({
            where: { id: request.params.id },
            data: body,
            include: {
                category: true,
                defaultSupplier: true,
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...product,
                createdAt: product.createdAt.toISOString(),
                updatedAt: product.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Delete product
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Delete product',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        // Ensure product exists and belongs to restaurant
        const existing = await prisma.product.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!existing) {
            throw errors.notFound('Product not found');
        }

        // Check if product is used in recipes
        const recipeCount = await prisma.recipeIngredient.count({
            where: { productId: request.params.id },
        });

        if (recipeCount > 0) {
            throw errors.conflict(`Product is used in ${recipeCount} recipe(s). Deactivate instead.`);
        }

        await prisma.product.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Product deleted successfully' },
        };

        return reply.send(response);
    });

    // Get low stock products
    fastify.get('/alerts/low-stock', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Get products with low stock',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const products = await prisma.$queryRaw`
      SELECT id, name, sku, "currentStock", "minStock", "baseUnit", "avgCost"
      FROM "Product"
      WHERE "restaurantId" = ${request.user!.restaurantId}
        AND "isActive" = true
        AND "currentStock" <= "minStock"
      ORDER BY ("currentStock" / NULLIF("minStock", 0)) ASC
      LIMIT 20
    `;

        const response: ApiResponse = {
            success: true,
            data: products,
        };

        return reply.send(response);
    });

    // Get expiring products
    fastify.get('/alerts/expiring', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Get products expiring soon',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const batches = await prisma.stockBatch.findMany({
            where: {
                product: {
                    restaurantId: request.user!.restaurantId,
                },
                remainingQty: { gt: 0 },
                expirationDate: { lte: sevenDaysFromNow },
            },
            include: {
                product: {
                    select: { id: true, name: true, sku: true, baseUnit: true },
                },
            },
            orderBy: { expirationDate: 'asc' },
            take: 20,
        });

        const response: ApiResponse = {
            success: true,
            data: batches.map((b) => ({
                ...b,
                expirationDate: b.expirationDate?.toISOString(),
                createdAt: b.createdAt.toISOString(),
            })),
        };

        return reply.send(response);
    });
}
