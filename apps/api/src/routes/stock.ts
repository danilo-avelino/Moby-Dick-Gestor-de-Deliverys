import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const createMovementSchema = z.object({
    productId: z.string(),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'WASTE', 'RETURN']),
    quantity: z.number().positive(),
    unit: z.string(),
    costPerUnit: z.number().min(0).optional(),
    supplierId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    notes: z.string().optional(),
    batchNumber: z.string().optional(),
    expirationDate: z.string().optional(),
});

export async function stockRoutes(fastify: FastifyInstance) {
    // List movements
    fastify.get<{
        Querystring: {
            page?: string;
            limit?: string;
            productId?: string;
            type?: string;
            startDate?: string;
            endDate?: string;
        };
    }>('/movements', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Stock'],
            summary: 'List stock movements',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = {
            product: {
                restaurantId: request.user!.restaurantId,
            },
        };

        if (request.query.productId) {
            where.productId = request.query.productId;
        }

        if (request.query.type) {
            where.type = request.query.type;
        }

        if (request.query.startDate) {
            where.createdAt = { ...where.createdAt, gte: new Date(request.query.startDate) };
        }

        if (request.query.endDate) {
            where.createdAt = { ...where.createdAt, lte: new Date(request.query.endDate) };
        }

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true, sku: true, baseUnit: true } },
                    supplier: { select: { id: true, name: true } },
                    user: { select: { id: true, firstName: true, lastName: true } },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.stockMovement.count({ where }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                data: movements.map((m) => ({
                    ...m,
                    createdAt: m.createdAt.toISOString(),
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

    // Create movement (entry/exit/adjustment)
    fastify.post('/movements', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Stock'],
            summary: 'Create stock movement',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createMovementSchema.parse(request.body);

        // Verify product belongs to restaurant
        const product = await prisma.product.findFirst({
            where: {
                id: body.productId,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!product) {
            throw errors.notFound('Product not found');
        }

        // Calculate quantity change and new stock
        const isEntry = body.type === 'IN' || body.type === 'RETURN';
        const quantityChange = isEntry ? body.quantity : -body.quantity;
        const newStock = product.currentStock + quantityChange;

        // Check if we'd go negative
        if (newStock < 0) {
            throw errors.badRequest(`Insufficient stock. Current: ${product.currentStock} ${product.baseUnit}`);
        }

        // Determine cost per unit
        let costPerUnit = body.costPerUnit || 0;
        if (body.type === 'IN' && !costPerUnit) {
            costPerUnit = product.lastPurchasePrice || 0;
        } else if (!isEntry) {
            costPerUnit = product.avgCost;
        }

        const totalCost = costPerUnit * body.quantity;

        // Create batch for entries with expiration
        let batchId: string | undefined;
        if (body.type === 'IN' && (body.batchNumber || body.expirationDate)) {
            const batch = await prisma.stockBatch.create({
                data: {
                    productId: body.productId,
                    batchNumber: body.batchNumber || `BATCH-${Date.now()}`,
                    quantity: body.quantity,
                    remainingQty: body.quantity,
                    costPerUnit,
                    expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
                },
            });
            batchId = batch.id;
        }

        // Calculate new average cost for entries
        let newAvgCost = product.avgCost;
        if (body.type === 'IN' && costPerUnit > 0) {
            const currentValue = product.currentStock * product.avgCost;
            const entryValue = body.quantity * costPerUnit;
            newAvgCost = (currentValue + entryValue) / (product.currentStock + body.quantity);
        }

        // Create movement and update product in transaction
        const [movement] = await prisma.$transaction([
            prisma.stockMovement.create({
                data: {
                    productId: body.productId,
                    type: body.type as any,
                    quantity: body.quantity,
                    unit: body.unit,
                    costPerUnit,
                    totalCost,
                    stockBefore: product.currentStock,
                    stockAfter: newStock,
                    referenceType: body.type === 'IN' ? 'PURCHASE' : body.type === 'ADJUSTMENT' ? 'ADJUSTMENT' : body.type === 'WASTE' ? 'WASTE' : undefined,
                    supplierId: body.supplierId,
                    invoiceNumber: body.invoiceNumber,
                    notes: body.notes,
                    batchId,
                    userId: request.user!.id,
                },
                include: {
                    product: { select: { id: true, name: true } },
                    supplier: { select: { id: true, name: true } },
                },
            }),
            prisma.product.update({
                where: { id: body.productId },
                data: {
                    currentStock: newStock,
                    avgCost: newAvgCost,
                    ...(body.type === 'IN' && {
                        lastPurchasePrice: costPerUnit,
                        lastPurchaseDate: new Date(),
                    }),
                },
            }),
        ]);

        // Create alert if stock is low
        if (newStock <= product.minStock) {
            await prisma.alert.create({
                data: {
                    restaurantId: request.user!.restaurantId!,
                    type: 'STOCK_LOW',
                    severity: newStock <= 0 ? 'CRITICAL' : 'HIGH',
                    title: `Estoque Baixo: ${product.name}`,
                    message: `O produto ${product.name} está com estoque ${newStock <= 0 ? 'zerado' : 'abaixo do mínimo'}. Quantidade atual: ${newStock} ${product.baseUnit}`,
                    data: { productId: product.id, currentStock: newStock, minStock: product.minStock },
                    actionUrl: `/products/${product.id}`,
                },
            });
        }

        const response: ApiResponse = {
            success: true,
            data: {
                ...movement,
                createdAt: movement.createdAt.toISOString(),
                newStock,
                newAvgCost,
            },
        };

        return reply.status(201).send(response);
    });

    // Bulk entry (multiple products)
    fastify.post<{
        Body: {
            supplierId?: string;
            invoiceNumber?: string;
            items: Array<{
                productId: string;
                quantity: number;
                unit: string;
                costPerUnit: number;
                batchNumber?: string;
                expirationDate?: string;
            }>;
        };
    }>('/movements/bulk-entry', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Stock'],
            summary: 'Bulk stock entry',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { supplierId, invoiceNumber, items } = request.body;

        if (!items || items.length === 0) {
            throw errors.badRequest('Items are required');
        }

        // Verify all products exist
        const productIds = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                restaurantId: request.user!.restaurantId,
            },
        });

        if (products.length !== productIds.length) {
            throw errors.badRequest('Some products not found');
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        // Process all entries in transaction
        const movements = await prisma.$transaction(async (tx) => {
            const results = [];

            for (const item of items) {
                const product = productMap.get(item.productId)!;
                const newStock = product.currentStock + item.quantity;

                // Calculate new average cost
                const currentValue = product.currentStock * product.avgCost;
                const entryValue = item.quantity * item.costPerUnit;
                const newAvgCost = (currentValue + entryValue) / newStock;

                // Create batch if needed
                let batchId: string | undefined;
                if (item.batchNumber || item.expirationDate) {
                    const batch = await tx.stockBatch.create({
                        data: {
                            productId: item.productId,
                            batchNumber: item.batchNumber || `BATCH-${Date.now()}`,
                            quantity: item.quantity,
                            remainingQty: item.quantity,
                            costPerUnit: item.costPerUnit,
                            expirationDate: item.expirationDate ? new Date(item.expirationDate) : undefined,
                        },
                    });
                    batchId = batch.id;
                }

                // Create movement
                const movement = await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        type: 'IN',
                        quantity: item.quantity,
                        unit: item.unit,
                        costPerUnit: item.costPerUnit,
                        totalCost: item.quantity * item.costPerUnit,
                        stockBefore: product.currentStock,
                        stockAfter: newStock,
                        referenceType: 'PURCHASE',
                        supplierId,
                        invoiceNumber,
                        batchId,
                        userId: request.user!.id,
                    },
                });

                // Update product
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        currentStock: newStock,
                        avgCost: newAvgCost,
                        lastPurchasePrice: item.costPerUnit,
                        lastPurchaseDate: new Date(),
                    },
                });

                results.push({
                    productId: item.productId,
                    productName: product.name,
                    quantity: item.quantity,
                    newStock,
                    newAvgCost,
                });

                // Update product map for subsequent calculations
                productMap.set(item.productId, {
                    ...product,
                    currentStock: newStock,
                    avgCost: newAvgCost,
                });
            }

            return results;
        });

        const response: ApiResponse = {
            success: true,
            data: {
                message: `${movements.length} items processed successfully`,
                items: movements,
            },
        };

        return reply.status(201).send(response);
    });

    // Get stock summary
    fastify.get('/summary', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Stock'],
            summary: 'Get stock summary',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const products = await prisma.product.findMany({
            where: {
                restaurantId: request.user!.restaurantId,
                isActive: true,
            },
            select: {
                id: true,
                currentStock: true,
                minStock: true,
                avgCost: true,
            },
        });

        const totalValue = products.reduce((sum, p) => sum + (p.currentStock * p.avgCost), 0);
        const lowStockCount = products.filter((p) => p.currentStock <= p.minStock).length;
        const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;

        // Get recent movements
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [entriesTotal, exitsTotal] = await Promise.all([
            prisma.stockMovement.aggregate({
                where: {
                    product: { restaurantId: request.user!.restaurantId },
                    type: 'IN',
                    createdAt: { gte: today },
                },
                _sum: { totalCost: true },
            }),
            prisma.stockMovement.aggregate({
                where: {
                    product: { restaurantId: request.user!.restaurantId },
                    type: { in: ['OUT', 'WASTE'] },
                    createdAt: { gte: today },
                },
                _sum: { totalCost: true },
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: {
                totalProducts: products.length,
                totalValue,
                lowStockCount,
                outOfStockCount,
                todayEntries: entriesTotal._sum.totalCost || 0,
                todayExits: exitsTotal._sum.totalCost || 0,
            },
        };

        return reply.send(response);
    });

    // Get batches for a product
    fastify.get<{ Params: { productId: string } }>('/batches/:productId', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Stock'],
            summary: 'Get product batches',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const batches = await prisma.stockBatch.findMany({
            where: {
                productId: request.params.productId,
                product: { restaurantId: request.user!.restaurantId },
                remainingQty: { gt: 0 },
            },
            orderBy: { expirationDate: 'asc' },
        });

        const response: ApiResponse = {
            success: true,
            data: batches.map((b) => ({
                ...b,
                manufactureDate: b.manufactureDate?.toISOString(),
                expirationDate: b.expirationDate?.toISOString(),
                createdAt: b.createdAt.toISOString(),
            })),
        };

        return reply.send(response);
    });

    // Inventory count / adjustment
    fastify.post<{
        Body: {
            items: Array<{
                productId: string;
                countedQuantity: number;
                notes?: string;
            }>;
        };
    }>('/inventory', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Stock'],
            summary: 'Submit inventory count',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { items } = request.body;

        if (!items || items.length === 0) {
            throw errors.badRequest('Items are required');
        }

        const productIds = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                restaurantId: request.user!.restaurantId,
            },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        const adjustments = await prisma.$transaction(async (tx) => {
            const results = [];

            for (const item of items) {
                const product = productMap.get(item.productId);
                if (!product) continue;

                const difference = item.countedQuantity - product.currentStock;
                if (difference === 0) continue;

                // Create adjustment movement
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        type: 'ADJUSTMENT',
                        quantity: Math.abs(difference),
                        unit: product.baseUnit,
                        costPerUnit: product.avgCost,
                        totalCost: Math.abs(difference) * product.avgCost,
                        stockBefore: product.currentStock,
                        stockAfter: item.countedQuantity,
                        referenceType: 'INVENTORY',
                        notes: item.notes || `Inventory adjustment: ${product.currentStock} -> ${item.countedQuantity}`,
                        userId: request.user!.id,
                    },
                });

                // Update product
                await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: item.countedQuantity },
                });

                results.push({
                    productId: item.productId,
                    productName: product.name,
                    previousStock: product.currentStock,
                    countedStock: item.countedQuantity,
                    difference,
                    value: difference * product.avgCost,
                });
            }

            return results;
        });

        const response: ApiResponse = {
            success: true,
            data: {
                message: `${adjustments.length} products adjusted`,
                adjustments,
                totalDifference: adjustments.reduce((sum, a) => sum + a.difference, 0),
                totalValue: adjustments.reduce((sum, a) => sum + a.value, 0),
            },
        };

        return reply.status(201).send(response);
    });
}
