import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import * as XLSX from 'xlsx';
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
    lastPurchasePrice: optionalPositiveNumber,
    unitType: z.enum(['WEIGHT', 'VOLUME', 'UNIT', 'LENGTH']).default('UNIT'),
    conversions: z.record(z.number()).optional().nullable(),
    currentStock: optionalPositiveNumber,
    reorderPoint: optionalNumber,
    manualReorderPoint: optionalNumber,
    isPerishable: z.boolean().optional(),
    isCmv: z.boolean().optional(),
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
        preHandler: [authenticate],
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

        // STRICT MULTI-TENANCY FILTER
        // STRICT MULTI-TENANCY FILTER
        if (request.user.role !== 'SUPER_ADMIN') {
            if (!request.user.organizationId) {
                return reply.send({
                    success: true,
                    data: {
                        data: [],
                        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
                    }
                });
            }
            where.organizationId = request.user.organizationId;
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
                        reorderPoint: p.reorderPoint ?? 0, // Return 0 instead of undefined for consistent filtering
                        manualReorderPoint: p.manualReorderPoint || undefined,
                        avgCost: p.avgCost,
                        lastPurchasePrice: p.lastPurchasePrice,
                        isPerishable: p.isPerishable,
                        shelfLifeDays: p.shelfLifeDays || undefined,
                        defaultSupplier: p.defaultSupplier || undefined,
                        isActive: p.isActive,
                        imageUrl: p.imageUrl || undefined,
                        // countsCMV: p.countsCMV, // Field does not exist in DB
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
        preHandler: [authenticate],
        schema: {
            tags: ['Products'],
            summary: 'Get product by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.id };

        // STRICT MULTI-TENANCY FILTER
        // STRICT MULTI-TENANCY FILTER
        if (request.user.role !== 'SUPER_ADMIN') {
            if (!request.user.organizationId) {
                throw errors.forbidden('Organization context required');
            }
            where.organizationId = request.user.organizationId;
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
        preHandler: [authenticate],
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
                    organizationId: request.user!.organizationId!,
                    sku: body.sku,
                },
            });
            if (existing) {
                throw errors.conflict('SKU already exists');
            }
        }

        const product = await prisma.$transaction(async (tx) => {
            const newProduct = await tx.product.create({
                data: {
                    ...body,
                    conversions: body.conversions ?? undefined,
                    organizationId: request.user!.organizationId!,
                },
                include: {
                    category: true,
                    defaultSupplier: true,
                },
            });

            // Create initial stock movement if defined
            if (body.currentStock && body.currentStock > 0) {
                await tx.stockMovement.create({
                    data: {
                        productId: newProduct.id,
                        type: 'ADJUSTMENT',
                        unit: newProduct.baseUnit,
                        quantity: body.currentStock,
                        stockBefore: 0,
                        stockAfter: body.currentStock,
                        costPerUnit: newProduct.lastPurchasePrice || newProduct.avgCost || 0,
                        totalCost: (newProduct.lastPurchasePrice || newProduct.avgCost || 0) * body.currentStock,
                        notes: 'Estoque inicial (Cadastro de Produto)',
                        userId: request.user?.id,
                        organizationId: request.user!.organizationId,
                    }
                });
            }

            return newProduct;
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
        preHandler: [authenticate],
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
        if (request.user.role !== 'SUPER_ADMIN') {
            where.organizationId = request.user.organizationId;
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
                    organizationId: request.user!.organizationId!,
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
            'lastPurchasePrice', 'unitType', 'conversions', 'reorderPoint', 'manualReorderPoint',
            'isPerishable', 'isCmv', 'shelfLifeDays', 'defaultSupplierId', 'leadTimeDays',
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
        preHandler: [authenticate],
        schema: {
            tags: ['Products'],
            summary: 'Delete product',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        // Ensure product exists and belongs to restaurant
        const where: any = { id: request.params.id };
        if (request.user.role !== 'SUPER_ADMIN') {
            where.organizationId = request.user.organizationId;
        }

        const existing = await prisma.product.findFirst({
            where,
        });

        if (!existing) {
            throw errors.notFound('Product not found');
        }

        // Check if product is used in recipes
        const recipesUsingProduct = await prisma.recipeIngredient.findMany({
            where: { productId: request.params.id },
            include: {
                recipe: {
                    select: { name: true, isActive: true }
                }
            }
        });

        if (recipesUsingProduct.length > 0) {
            // Filter out ingredients that might be orphaned (no recipe) if that's possible, 
            // though Prisma relation should prevent it unless optional. 
            // Recipe is non-nullable in schema: `recipe Recipe ...` so no orphans.

            const recipeNames = recipesUsingProduct
                .map(r => r.recipe.name)
                .slice(0, 3) // List first 3
                .join(', ');

            const count = recipesUsingProduct.length;
            const morText = count > 3 ? ` and ${count - 3} more` : '';

            throw errors.conflict(`Product is used in ${count} recipe(s): ${recipeNames}${morText}. Please remove it from recipes first.`);
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
        preHandler: [authenticate],
        schema: {
            tags: ['Products'],
            summary: 'Get products with low stock',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const products = await prisma.$queryRaw`
      SELECT id, name, sku, "currentStock", "reorderPoint", "baseUnit", "avgCost"
      FROM "Product"
      WHERE "organizationId" = ${request.user!.organizationId}
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
        preHandler: [authenticate],
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
                    organizationId: request.user!.organizationId,
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

    // Helper for number parsing (handles "10,50" strings from Excel)
    const parseExcelNumber = (val: any, defaultVal = 0): number => {
        if (val === undefined || val === null || val === '') return defaultVal;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const clean = val.replace(',', '.'); // Handle PT-BR
            const num = parseFloat(clean);
            return isNaN(num) ? defaultVal : num;
        }
        return defaultVal;
    };

    // Export products
    fastify.get('/export', {
        preHandler: [authenticate],
        schema: {
            tags: ['Products'],
            summary: 'Export products to Excel',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = {};
        if (request.user.role !== 'SUPER_ADMIN') {
            where.organizationId = request.user.organizationId;
        }

        const products = await prisma.product.findMany({
            where,
            include: {
                category: true,
                defaultSupplier: true,
            },
            orderBy: { name: 'asc' },
        });

        // Define strict columns and verify data types
        const data = products.map(p => ({
            'Nome': p.name,
            'SKU': p.sku || '',
            'Código de Barras': p.barcode || '',
            'Categoria': p.category?.name || '',
            'Descrição': p.description || '',
            'Unidade': p.baseUnit,
            'Tipo Unidade': p.unitType,
            'Estoque Atual': p.currentStock,
            'Ponto de Reposição': p.reorderPoint || 0,
            'Ponto de Reposição Manual': p.manualReorderPoint || '',
            'Custo Médio': p.avgCost,
            'Preço Última Compra': p.lastPurchasePrice || 0,
            'Fornecedor Padrão': p.defaultSupplier?.name || '',
            'Perecível': p.isPerishable ? 'Sim' : 'Não',
            'Dias de Validade': p.shelfLifeDays || '',
            'Dias de Lead Time': p.leadTimeDays || 1,
            'Ativo': p.isActive ? 'Sim' : 'Não',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('Content-Disposition', `attachment; filename="produtos-${new Date().toISOString().split('T')[0]}.xlsx"`);
        return reply.send(buffer);
    });

    fastify.post('/import', {
        preHandler: [authenticate],
        schema: {
            tags: ['Products'],
            summary: 'Import products from Excel',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        console.log('📥 Import request received');
        try {
            const data = await request.file();
            console.log('📁 File received:', data?.filename);

            if (!data) {
                console.log('❌ No file in request');
                throw errors.badRequest('File is required');
            }

            const buffer = await data.toBuffer();
            console.log('💾 File buffered, size:', buffer.length);

            const wb = XLSX.read(buffer, { type: 'buffer' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws);

            const results = {
                total: jsonData.length,
                created: 0,
                updated: 0,
                errors: [] as string[],
            };

            for (const [index, row] of jsonData.entries()) {
                const rowIndex = index + 2; // Excel header is 1
                try {
                    const r = row as any;
                    const name = r['Nome'];
                    if (!name) {
                        results.errors.push(`Linha ${rowIndex}: Nome é obrigatório`);
                        continue;
                    }

                    // Prepare data with parsing safety
                    const productData: any = {
                        name: String(name).trim(),
                        sku: r['SKU'] ? String(r['SKU']).trim() : undefined,
                        barcode: r['Código de Barras'] ? String(r['Código de Barras']).trim() : undefined,
                        description: r['Descrição'] ? String(r['Descrição']) : undefined,
                        baseUnit: r['Unidade'] ? String(r['Unidade']).trim() : 'un',
                        unitType: ['WEIGHT', 'VOLUME', 'UNIT', 'LENGTH'].includes(r['Tipo Unidade']) ? r['Tipo Unidade'] : 'UNIT',
                        currentStock: parseExcelNumber(r['Estoque Atual']),
                        reorderPoint: parseExcelNumber(r['Ponto de Reposição']),
                        manualReorderPoint: r['Ponto de Reposição Manual'] ? parseExcelNumber(r['Ponto de Reposição Manual']) : undefined,
                        avgCost: parseExcelNumber(r['Custo Médio']),
                        lastPurchasePrice: parseExcelNumber(r['Preço Última Compra']),
                        isPerishable: r['Perecível'] === 'Sim' || r['Perecível'] === 'true',
                        shelfLifeDays: r['Dias de Validade'] ? parseExcelNumber(r['Dias de Validade']) : undefined,
                        leadTimeDays: r['Dias de Lead Time'] ? parseExcelNumber(r['Dias de Lead Time']) : 1,
                        isActive: r['Ativo'] !== 'Não' && r['Ativo'] !== 'false', // Default active
                        organizationId: request.user.organizationId!,
                    };

                    // Clean undefined/empty strings for optional matches
                    if (productData.sku === '') productData.sku = undefined;
                    if (productData.barcode === '') productData.barcode = undefined;

                    // Handle Category
                    if (r['Categoria']) {
                        const categoryName = String(r['Categoria']).trim();
                        // Find or Create logic...
                        let category = await prisma.productCategory.findFirst({
                            where: { name: { equals: categoryName, mode: 'insensitive' }, organizationId: request.user.organizationId }
                        });
                        if (!category) {
                            category = await prisma.productCategory.create({
                                data: { name: categoryName, organizationId: request.user.organizationId! }
                            }).catch(async () => {
                                // Race condition fallback
                                return prisma.productCategory.findFirst({
                                    where: { name: { equals: categoryName, mode: 'insensitive' }, organizationId: request.user.organizationId }
                                });
                            });
                        }
                        if (category) productData.categoryId = category.id;
                    }

                    // Handle Supplier
                    if (r['Fornecedor Padrão']) {
                        const supplierName = String(r['Fornecedor Padrão']).trim();
                        let supplier = await prisma.supplier.findFirst({
                            where: { name: { equals: supplierName, mode: 'insensitive' }, organizationId: request.user.organizationId }
                        });
                        if (!supplier) {
                            supplier = await prisma.supplier.create({
                                data: { name: supplierName, organizationId: request.user.organizationId! }
                            }).catch(async () => {
                                return prisma.supplier.findFirst({
                                    where: { name: { equals: supplierName, mode: 'insensitive' }, organizationId: request.user.organizationId }
                                });
                            });
                        }
                        if (supplier) productData.defaultSupplierId = supplier.id;
                    }

                    // Upsert logic (SKU Priority, then Name)
                    let existingProduct = null;
                    if (productData.sku) {
                        existingProduct = await prisma.product.findFirst({
                            where: { organizationId: request.user.organizationId, sku: productData.sku }
                        });
                    }
                    if (!existingProduct) {
                        existingProduct = await prisma.product.findFirst({
                            where: { organizationId: request.user.organizationId, name: { equals: productData.name, mode: 'insensitive' } }
                        });
                    }

                    if (existingProduct) {
                        await prisma.product.update({
                            where: { id: existingProduct.id },
                            data: productData
                        });
                        results.updated++;
                    } else {
                        await prisma.product.create({
                            data: productData
                        });
                        results.created++;
                    }

                } catch (err: any) {
                    console.error('Import error row', index, err);
                    results.errors.push(`Linha ${rowIndex}: ${err.message}`);
                }
            }

            return reply.send({
                success: true,
                data: {
                    message: `Importação concluída. ${results.created} criados, ${results.updated} atualizados.`,
                    ...results
                }
            });

        } catch (err: any) {
            console.error('❌ Import handler fatal error:', err);
            // Log to file for deep debug if needed
            return reply.status(500).send({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: `Falha ao processar arquivo: ${err.message}`
                }
            });
        }
    });


    // Delete ALL products for the restaurant (dangerous operation)
    fastify.delete('/all', {

        preHandler: [authenticate],
        schema: {
            tags: ['Products'],
            summary: 'Delete ALL products (dangerous)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const organizationId = request.user!.organizationId!;

        // Delete related records first (in order to avoid foreign key constraints)
        // 1. Delete stock movements
        await prisma.stockMovement.deleteMany({
            where: {
                product: {
                    organizationId,
                },
            },
        });

        // 2. Delete stock batches
        await prisma.stockBatch.deleteMany({
            where: {
                product: {
                    organizationId,
                },
            },
        });

        // 3. Delete inventory items
        await prisma.inventoryItem.deleteMany({
            where: {
                product: {
                    organizationId,
                },
            },
        });

        // 4. Delete recipe ingredients
        await prisma.recipeIngredient.deleteMany({
            where: {
                product: {
                    organizationId,
                },
            },
        });

        // 5. Delete purchase suggestions
        await prisma.purchaseSuggestion.deleteMany({
            where: {
                product: {
                    organizationId,
                },
            },
        });

        // 6. Delete consumption anomalies
        await prisma.consumptionAnomaly.deleteMany({
            where: {
                product: {
                    organizationId,
                },
            },
        });

        // 7. Delete portioning processes
        await prisma.portioningProcess.deleteMany({
            where: {
                rawProduct: {
                    organizationId,
                },
            },
        });

        // 8. Finally, delete all products
        const result = await prisma.product.deleteMany({
            where: { organizationId },
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
