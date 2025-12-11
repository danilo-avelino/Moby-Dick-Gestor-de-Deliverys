import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse, PaginatedResponse, ProductDTO } from 'types';

// Helper to handle NaN and empty values for optional numbers
const optionalNumber = z.preprocess(
    (val) => (val === '' || val === null || Number.isNaN(val) ? undefined : val),
    z.number().optional()
);

const optionalPositiveNumber = z.preprocess(
    (val) => (val === '' || val === null || Number.isNaN(val) ? undefined : val),
    z.number().min(0).optional()
);

const createProductSchema = z.object({
    sku: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().optional()),
    barcode: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().optional()),
    name: z.string().min(2),
    description: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().optional()),
    categoryId: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().optional()),
    baseUnit: z.string().default('un'),
    unitType: z.enum(['WEIGHT', 'VOLUME', 'UNIT', 'LENGTH']).default('UNIT'),
    conversions: z.record(z.number()).optional().nullable(),
    reorderPoint: optionalNumber,
    manualReorderPoint: optionalNumber,
    isPerishable: z.boolean().optional(),
    shelfLifeDays: optionalPositiveNumber,
    defaultSupplierId: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().optional()),
    leadTimeDays: z.preprocess(
        (val) => (val === '' || val === null || Number.isNaN(val) ? 1 : val),
        z.number().min(0).default(1)
    ),
    imageUrl: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().url().optional()),
});

// Allow extra fields from frontend (like createdAt, updatedAt, movements, etc) to pass through
const updateProductSchema = createProductSchema.partial().extend({
    isActive: z.boolean().optional(),
}).passthrough();

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
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 1000);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        if (request.query.search) {
            console.log(`🔍 Searching products for: "${request.query.search}"`);
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

        // if (request.query.lowStock === 'true') {
        //     where.currentStock = { lte: prisma.product.fields.reorderPoint };
        // }

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

        // Get 30-day consumption for all products in the list
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const productIds = products.map(p => p.id);

        // Get consumption aggregates for all products at once
        const consumptionData = await prisma.stockMovement.groupBy({
            by: ['productId'],
            where: {
                productId: { in: productIds },
                createdAt: { gte: thirtyDaysAgo },
                type: { in: ['OUT', 'WASTE'] }
            },
            _sum: { quantity: true }
        });

        // Create a map for quick lookup
        const consumptionMap = new Map(
            consumptionData.map(c => [c.productId, c._sum.quantity || 0])
        );

        const response: ApiResponse<PaginatedResponse<ProductDTO>> = {
            success: true,
            data: {
                data: products.map((p) => {
                    const last30DaysConsumption = consumptionMap.get(p.id) || 0;
                    const dailyAverage = last30DaysConsumption / 30;
                    const autonomyDays = dailyAverage > 0
                        ? Math.round(p.currentStock / dailyAverage)
                        : null; // null means no consumption data

                    return {
                        id: p.id,
                        sku: p.sku || undefined,
                        barcode: p.barcode || undefined,
                        name: p.name,
                        description: p.description || undefined,
                        category: p.category || undefined,
                        baseUnit: p.baseUnit,
                        currentStock: p.currentStock,
                        reorderPoint: p.reorderPoint || undefined,
                        manualReorderPoint: p.manualReorderPoint || undefined,
                        avgCost: p.avgCost,
                        lastPurchasePrice: p.lastPurchasePrice,
                        isPerishable: p.isPerishable,
                        shelfLifeDays: p.shelfLifeDays || undefined,
                        defaultSupplier: p.defaultSupplier || undefined,
                        isActive: p.isActive,
                        imageUrl: p.imageUrl || undefined,
                        countsCMV: p.countsCMV,
                        last30DaysConsumption,
                        autonomyDays,
                        createdAt: p.createdAt.toISOString(),
                        updatedAt: p.updatedAt.toISOString(),
                    };
                }),
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
        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const product = await prisma.product.findFirst({
            where,
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

        // Get recipe count
        const recipeCount = await prisma.recipeIngredient.count({
            where: { productId: product.id }
        });

        // Get extended movements for chart (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const chartMovements = await prisma.stockMovement.findMany({
            where: {
                productId: product.id,
                createdAt: { gte: thirtyDaysAgo }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Calculate last 7 days consumption (OUT + WASTE)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const last7DaysConsumption = await prisma.stockMovement.aggregate({
            where: {
                productId: product.id,
                createdAt: { gte: sevenDaysAgo },
                type: { in: ['OUT', 'WASTE'] }
            },
            _sum: { quantity: true }
        });

        // Calculate last 30 days consumption (OUT + WASTE)
        const last30DaysConsumption = await prisma.stockMovement.aggregate({
            where: {
                productId: product.id,
                createdAt: { gte: thirtyDaysAgo },
                type: { in: ['OUT', 'WASTE'] }
            },
            _sum: { quantity: true }
        });

        // Calculate effective reorder point (manual overrides automatic)
        const effectiveReorderPoint = product.manualReorderPoint ?? product.reorderPoint ?? 0;

        const response: ApiResponse = {
            success: true,
            data: {
                ...product,
                effectiveReorderPoint, // Add effective reorder point for frontend use
                createdAt: product.createdAt.toISOString(),
                updatedAt: product.updatedAt.toISOString(),
                recipeCount, // New field
                movements: product.movements.map((m) => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
                })),
                chartData: chartMovements.map(m => ({ // New field for graph
                    date: m.createdAt.toISOString(),
                    quantity: m.quantity,
                    type: m.type,
                    stockAfter: m.stockAfter,
                    balance: 0 // Keep for type compat? Or rely on stockAfter
                })),
                last7DaysConsumption: last7DaysConsumption._sum.quantity || 0,
                last30DaysConsumption: last30DaysConsumption._sum.quantity || 0,
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
        const result = updateProductSchema.safeParse(request.body);
        if (!result.success) {
            console.error('Product validation error:', JSON.stringify(result.error.issues, null, 2));
            console.error('Request body:', JSON.stringify(request.body, null, 2));
            throw errors.badRequest('Validation failed: ' + result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '));
        }
        const body = result.data;

        // Ensure product exists and belongs to restaurant
        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const existing = await prisma.product.findFirst({
            where,
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

        // Filter only the fields that can be updated
        const allowedFields = [
            'sku', 'barcode', 'name', 'description', 'categoryId', 'baseUnit',
            'unitType', 'conversions', 'reorderPoint', 'manualReorderPoint',
            'isPerishable', 'shelfLifeDays', 'defaultSupplierId', 'leadTimeDays',
            'imageUrl', 'isActive'
        ];

        const updateData: Record<string, any> = {};
        for (const key of allowedFields) {
            if (key in body && (body as any)[key] !== undefined) {
                updateData[key] = (body as any)[key];
            }
        }

        const product = await prisma.product.update({
            where: { id: request.params.id },
            data: updateData,
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
        const where: any = { id: request.params.id };
        if (request.user?.restaurantId) {
            where.restaurantId = request.user.restaurantId;
        }

        const existing = await prisma.product.findFirst({
            where,
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
      SELECT id, name, sku, "currentStock", "reorderPoint", "baseUnit", "avgCost"
      FROM "Product"
      WHERE "restaurantId" = ${request.user!.restaurantId}
        AND "isActive" = true
        AND "currentStock" <= "reorderPoint"
      ORDER BY ("currentStock" / NULLIF("reorderPoint", 0)) ASC
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

    // Delete ALL products for the restaurant (dangerous operation)
    fastify.delete('/all', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Products'],
            summary: 'Delete ALL products (dangerous)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const restaurantId = request.user!.restaurantId!;

        // Delete related records first (in order to avoid foreign key constraints)
        // 1. Delete stock movements
        await prisma.stockMovement.deleteMany({
            where: {
                product: {
                    restaurantId,
                },
            },
        });

        // 2. Delete stock batches
        await prisma.stockBatch.deleteMany({
            where: {
                product: {
                    restaurantId,
                },
            },
        });

        // 3. Delete inventory items
        await prisma.inventoryItem.deleteMany({
            where: {
                product: {
                    restaurantId,
                },
            },
        });

        // 4. Delete recipe ingredients
        await prisma.recipeIngredient.deleteMany({
            where: {
                product: {
                    restaurantId,
                },
            },
        });

        // 5. Delete purchase suggestions
        await prisma.purchaseSuggestion.deleteMany({
            where: {
                product: {
                    restaurantId,
                },
            },
        });

        // 6. Delete consumption anomalies
        await prisma.consumptionAnomaly.deleteMany({
            where: {
                product: {
                    restaurantId,
                },
            },
        });

        // 7. Delete portioning processes
        await prisma.portioningProcess.deleteMany({
            where: {
                rawProduct: {
                    restaurantId,
                },
            },
        });

        // 8. Finally, delete all products
        const result = await prisma.product.deleteMany({
            where: { restaurantId },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                message: `${result.count} produtos excluídos com sucesso`,
                count: result.count,
            },
        };

        return reply.send(response);
    });
}
