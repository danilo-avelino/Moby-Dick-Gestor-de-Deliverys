import { prisma, MovementType, MovementReferenceType } from 'database';
import { randomUUID } from 'crypto';

export class InventoryService {

    // Generate or retrieve share token
    static async getShareToken(sessionId: string) {
        const session = await prisma.inventorySession.findUnique({
            where: { id: sessionId }
        });

        if (!session) throw new Error('Inventário não encontrado');

        if (session.shareToken) return session.shareToken;

        const token = randomUUID();

        await prisma.inventorySession.update({
            where: { id: sessionId },
            data: { shareToken: token }
        });

        return token;
    }

    // Get session by token
    static async getSessionByToken(token: string) {
        const session = await prisma.inventorySession.findUnique({
            where: { shareToken: token }
        });

        if (!session || session.status !== 'OPEN') {
            throw new Error('Link inválido ou inventário finalizado');
        }

        return session;
    }

    // Start a new inventory session
    static async startInventory(costCenterId: string, organizationId: string, userId: string, notes?: string) {
        // Check if there is already an open session
        const active = await prisma.inventorySession.findFirst({
            where: {
                costCenterId,
                status: 'OPEN'
            }
        });

        if (active) {
            throw new Error('Já existe um inventário em andamento.');
        }

        // Create session
        const session = await prisma.inventorySession.create({
            data: {
                costCenterId,
                status: 'OPEN',
                createdBy: userId,
                notes
            }
        });

        // Snapshot all active products
        const products = await prisma.product.findMany({
            where: {
                organizationId,
                isActive: true
            },
            include: {
                category: true
            }
        });

        // Create InventoryItem for each product taking a snapshot of current stock
        const inventoryItemsData = products.map(p => ({
            inventorySessionId: session.id,
            productId: p.id,
            productName: p.name,
            categoryName: p.category?.name || 'Sem Categoria',
            unit: p.baseUnit,
            costPerUnit: p.avgCost || 0,
            expectedQuantity: p.currentStock,
            countedQuantity: null, // Null means not counted yet
            difference: 0,
            isCorrect: false
        }));

        if (inventoryItemsData.length > 0) {
            await prisma.inventoryItem.createMany({
                data: inventoryItemsData
            });
        }

        return session;
    }

    // Get active inventory
    static async getActiveInventory(costCenterId: string) {
        return prisma.inventorySession.findFirst({
            where: {
                costCenterId,
                status: 'OPEN'
            },
            include: {
                _count: {
                    select: { items: true }
                }
            }
        });
    }

    // Get inventory details with items grouped by category
    static async getInventoryItems(sessionId: string, categoryId?: string) {
        const where: any = { inventorySessionId: sessionId };

        if (categoryId) {
            where.product = {
                categoryId: categoryId
            };
        }

        return prisma.inventoryItem.findMany({
            where,
            include: {
                product: {
                    select: {
                        name: true,
                        category: { select: { id: true, name: true } },
                        imageUrl: true,
                        baseUnit: true
                    }
                }
            },
            orderBy: {
                productName: 'asc'
            }
        });
    }

    // Submit user count
    static async updateItemCount(itemId: string, countedQuantity: number) {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId }
        });

        if (!item) throw new Error('Item não encontrado');

        const difference = countedQuantity - item.expectedQuantity;
        const isCorrect = Math.abs(difference) < 0.001; // Tolerance

        return prisma.inventoryItem.update({
            where: { id: itemId },
            data: {
                countedQuantity,
                difference,
                isCorrect,
                countedAt: new Date()
            }
        });
    }

    // Finish inventory
    static async finishInventory(sessionId: string, userId: string) {
        const session = await prisma.inventorySession.findUnique({
            where: { id: sessionId },
            include: { items: true }
        });

        if (!session) throw new Error('Inventário não encontrado');
        if (session.status !== 'OPEN') throw new Error('Inventário já finalizado ou cancelado');

        // Calculate stats
        const countedItems = session.items.filter(i => i.countedQuantity !== null);
        const correctItems = session.items.filter(i => i.isCorrect);

        const validCount = countedItems.length;
        const correctCount = correctItems.length;
        const precision = validCount > 0 ? (correctCount / validCount) * 100 : 0;

        // Update Stock and create Movements
        await prisma.$transaction(async (tx) => {
            for (const item of countedItems) {
                // Only update if there is a difference
                if (Math.abs(item.difference || 0) > 0.001) {
                    // Update Product Stock
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            currentStock: item.countedQuantity!
                        }
                    });

                    // Create Stock Movement
                    await tx.stockMovement.create({
                        data: {
                            productId: item.productId,
                            type: MovementType.ADJUSTMENT,
                            quantity: Math.abs(item.difference!),
                            unit: item.unit || 'un',
                            totalCost: Math.abs(item.difference!) * (item.costPerUnit || 0),
                            stockBefore: item.expectedQuantity,
                            stockAfter: item.countedQuantity!,
                            referenceType: MovementReferenceType.INVENTORY,
                            referenceId: session.id,
                            userId,
                            notes: `Ajuste de Inventário (Diferença: ${item.difference})`
                        }
                    });
                }
            }

            // Close session
            await tx.inventorySession.update({
                where: { id: sessionId },
                data: {
                    status: 'COMPLETED',
                    endDate: new Date(),
                    precision,
                    itemsCount: validCount,
                    itemsCorrect: correctCount
                }
            });

            // Update Stock Accuracy Indicator
            const indicator = await tx.indicator.findFirst({
                where: {
                    costCenterId: session.costCenterId,
                    name: 'Precisão de Estoque'
                }
            });

            if (indicator) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

                const monthlySessions = await tx.inventorySession.findMany({
                    where: {
                        costCenterId: session.costCenterId,
                        status: 'COMPLETED',
                        endDate: {
                            gte: startOfMonth,
                            lte: endOfMonth
                        }
                    },
                    select: {
                        precision: true
                    }
                });

                const precisions = monthlySessions
                    .map(s => s.precision)
                    .filter(p => p !== null) as number[];

                const avgPrecision = precisions.length > 0
                    ? precisions.reduce((a, b) => a + b, 0) / precisions.length
                    : precision;

                await tx.indicatorResult.create({
                    data: {
                        indicatorId: indicator.id,
                        value: avgPrecision,
                        targetSnapshot: indicator.targetValue,
                        date: new Date()
                    }
                });

                await tx.indicator.update({
                    where: { id: indicator.id },
                    data: {
                        currentValue: avgPrecision,
                        updatedAt: new Date()
                    }
                });
            }
        }, {
            maxWait: 10000,
            timeout: 60000
        });

        return { success: true, precision, itemsCount: validCount };
    }

    // Get inventory history
    static async getHistory(costCenterId: string) {
        return prisma.inventorySession.findMany({
            where: {
                costCenterId,
                status: 'COMPLETED'
            },
            orderBy: {
                endDate: 'desc'
            },
            take: 20
        });
    }
}
