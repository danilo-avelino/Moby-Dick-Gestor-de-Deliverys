import { prisma, MovementType, MovementReferenceType, PurchaseListTriggerType, PurchaseListStatus, PurchaseListItemStatus, Prisma, PurchaseFilterMode } from 'database';

export class PurchaseListService {

    /**
     * Generate a new purchase list based on reorder points
     * Returns products where currentStock < reorderPoint
     */
    static async generatePurchaseList(
        costCenterId: string,
        userId: string,
        triggerType: PurchaseListTriggerType,
        description?: string,
        notes?: string
    ) {
        // Get the cost center to find the organizationId
        const costCenter = await prisma.costCenter.findUnique({
            where: { id: costCenterId },
            select: { organizationId: true }
        });

        if (!costCenter?.organizationId) {
            throw new Error('Centro de custo não encontrado ou sem organização associada');
        }

        // Initialize where clause - Products are scoped by organizationId
        const whereClause: Prisma.ProductWhereInput = {
            organizationId: costCenter.organizationId,
            isActive: true,
            OR: [
                { reorderPoint: { gt: 0 } },
                { manualReorderPoint: { gt: 0 } }
            ]
        };

        // Get all active products matching criteria
        const products = await prisma.product.findMany({
            where: whereClause
        });

        // Calculate items that need replenishment
        const itemsToCreate: Array<{
            productId: string;
            productNameSnapshot: string;
            unitSnapshot: string;
            reorderPointSnapshot: number;
            currentStockSnapshot: number;
            suggestedQuantity: number;
        }> = [];

        for (const product of products) {
            const reorderPoint = product.manualReorderPoint ?? product.reorderPoint ?? 0;
            if (reorderPoint <= 0) continue;

            const missingQuantity = reorderPoint - product.currentStock;
            if (missingQuantity <= 0) continue;

            itemsToCreate.push({
                productId: product.id,
                productNameSnapshot: product.name,
                unitSnapshot: product.baseUnit,
                reorderPointSnapshot: reorderPoint,
                currentStockSnapshot: product.currentStock,
                suggestedQuantity: missingQuantity
            });
        }

        // Don't create empty lists
        if (itemsToCreate.length === 0) {
            return null;
        }

        // Create the purchase list with items
        const purchaseList = await prisma.purchaseList.create({
            data: {
                costCenterId,
                triggerType,
                description: description || `Lista de Compras - ${new Date().toLocaleDateString('pt-BR')}`,
                notes,
                createdById: userId,
                items: {
                    create: itemsToCreate
                }
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, baseUnit: true, imageUrl: true }
                        }
                    }
                },
                createdBy: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        });

        return purchaseList;
    }

    /**
     * Get all purchase lists for a cost center
     */
    static async getPurchaseLists(
        costCenterId: string,
        options?: {
            status?: PurchaseListStatus;
            triggerType?: PurchaseListTriggerType;
            startDate?: Date;
            endDate?: Date;
            page?: number;
            limit?: number;
        }
    ) {
        const { status, triggerType, startDate, endDate, page = 1, limit = 20 } = options || {};

        const where: any = { costCenterId };

        if (status) where.status = status;
        if (triggerType) where.triggerType = triggerType;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [data, total] = await Promise.all([
            prisma.purchaseList.findMany({
                where,
                include: {
                    _count: { select: { items: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.purchaseList.count({ where })
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get a single purchase list with all items
     */
    static async getPurchaseListById(listId: string, costCenterId: string) {
        return prisma.purchaseList.findFirst({
            where: { id: listId, costCenterId },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                baseUnit: true,
                                imageUrl: true,
                                currentStock: true,
                                lastPurchasePrice: true,
                                category: { select: { id: true, name: true } }
                            }
                        },
                        confirmedBy: { select: { id: true, firstName: true, lastName: true } }
                    },
                    orderBy: { productNameSnapshot: 'asc' }
                },
                createdBy: { select: { id: true, firstName: true, lastName: true } }
            }
        });
    }

    /**
     * Update purchase list status
     */
    static async updateListStatus(listId: string, status: PurchaseListStatus) {
        const data: any = { status };
        if (status === 'CONCLUIDA') {
            data.completedAt = new Date();
        }

        return prisma.purchaseList.update({
            where: { id: listId },
            data
        });
    }

    /**
     * Confirm item arrival and update stock
     */
    static async confirmItemArrival(
        itemId: string,
        confirmedQuantity: number,
        userId: string,
        purchasePrice?: number
    ) {
        // Get the item with product info
        const item = await prisma.purchaseListItem.findUnique({
            where: { id: itemId },
            include: {
                product: true,
                purchaseList: true
            }
        });

        if (!item) {
            throw new Error('Item não encontrado');
        }

        if (item.status === 'CHEGOU') {
            throw new Error('Item já foi confirmado');
        }

        // Determine new status
        let newStatus: PurchaseListItemStatus = 'CHEGOU';
        if (confirmedQuantity < item.suggestedQuantity) {
            newStatus = 'PARCIAL';
        }

        // Update item and create stock movement in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update the item
            const updatedItem = await tx.purchaseListItem.update({
                where: { id: itemId },
                data: {
                    confirmedQuantity,
                    status: newStatus,
                    confirmedAt: new Date(),
                    confirmedById: userId
                }
            });

            // Create stock movement (IN)
            const stockBefore = item.product.currentStock;
            const stockAfter = stockBefore + confirmedQuantity;

            await tx.stockMovement.create({
                data: {
                    productId: item.productId,
                    type: MovementType.IN,
                    quantity: confirmedQuantity,
                    unit: item.unitSnapshot,
                    stockBefore,
                    stockAfter,
                    referenceType: MovementReferenceType.PURCHASE,
                    referenceId: item.purchaseListId,
                    userId,
                    notes: `Entrada via Lista de Compras: ${item.purchaseList.description || item.purchaseListId}`
                }
            });

            // Build product update data
            const productUpdateData: any = {
                currentStock: stockAfter
            };

            // Update lastPurchasePrice and lastPurchaseDate if purchasePrice is provided
            if (purchasePrice !== undefined && purchasePrice > 0) {
                productUpdateData.lastPurchasePrice = purchasePrice;
                productUpdateData.lastPurchaseDate = new Date();
            }

            // Update product stock and price
            await tx.product.update({
                where: { id: item.productId },
                data: productUpdateData
            });

            // Check if all items in the list are confirmed
            const pendingItems = await tx.purchaseListItem.count({
                where: {
                    purchaseListId: item.purchaseListId,
                    status: 'PENDENTE'
                }
            });

            // Update list status if needed
            if (pendingItems === 0) {
                await tx.purchaseList.update({
                    where: { id: item.purchaseListId },
                    data: { status: 'CONCLUIDA', completedAt: new Date() }
                });
            } else {
                await tx.purchaseList.update({
                    where: { id: item.purchaseListId },
                    data: { status: 'EM_ANDAMENTO' }
                });
            }

            return updatedItem;
        });

        return result;
    }

    /**
     * Cancel a purchase list item
     */
    static async cancelItem(itemId: string) {
        return prisma.purchaseListItem.update({
            where: { id: itemId },
            data: { status: 'CANCELADO' }
        });
    }

    /**
     * Get or create purchase config for cost center
     */
    static async getConfig(costCenterId: string) {
        let config = await prisma.purchaseConfig.findUnique({
            where: { costCenterId }
        });

        if (!config) {
            config = await prisma.purchaseConfig.create({
                data: { costCenterId }
            });
        }

        return config;
    }

    /**
     * Update purchase config
     */
    static async updateConfig(
        costCenterId: string,
        data: {
            triggerPostInventory?: boolean;
            triggerCriticalStock?: boolean;
            criticalStockPercentage?: number;
            triggerFixedDates?: boolean;
            recurrenceType?: 'NENHUM' | 'SEMANAL' | 'MENSAL';
            weekDays?: number[];
            monthDays?: number[];
        }
    ) {
        return prisma.purchaseConfig.upsert({
            where: { costCenterId },
            create: { costCenterId, ...data },
            update: data
        });
    }
}
