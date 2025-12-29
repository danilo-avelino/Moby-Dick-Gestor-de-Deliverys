
import { prisma } from 'database';
import { Indicator } from '@prisma/client';
import dayjs from 'dayjs';

/**
 * Calculates the current value for a given indicator based on its type and cycle.
 */
export async function calculateIndicatorValue(indicator: Indicator): Promise<number> {
    const now = dayjs();
    const startOfMonth = now.startOf('month').toDate();
    const endOfMonth = now.endOf('month').toDate();

    // Determine period based on cycle (defaulting to current month for now as per requirements)
    // User said "measured monthly".
    const startDate = startOfMonth;
    const endDate = endOfMonth;

    switch (indicator.type) {
        case 'STOCK_CMV':
            return calculateStockCMV(indicator.costCenterId, startDate, endDate);

        case 'PURCHASING':
            return calculatePurchasing(indicator.costCenterId, startDate, endDate);

        case 'RECIPE_COVERAGE':
            return calculateRecipeCoverage(indicator.costCenterId);

        case 'WASTE_PERCENT':
            return calculateWastePercent(indicator.costCenterId, startDate, endDate);

        case 'REVENUE':
        case 'REVENUE_TARGET' as any:
            return calculateRevenue(indicator.costCenterId, startDate, endDate);

        case 'STOCK_ACCURACY' as any:
            return calculateStockAccuracy(indicator.costCenterId, startDate, endDate);


        default:
            return indicator.currentValue || 0;
    }
}

// Helper to get Organization ID
async function getOrgId(costCenterId: string): Promise<string | null> {
    const cc = await prisma.costCenter.findUnique({
        where: { id: costCenterId },
        select: { organizationId: true }
    });
    return cc?.organizationId || null;
}

async function calculateStockCMV(costCenterId: string, startDate: Date, endDate: Date): Promise<number> {
    const orgId = await getOrgId(costCenterId);
    if (!orgId) return 0;

    const revenueAgg = await prisma.revenue.aggregate({
        where: {
            costCenterId,
            startDate: { gte: startDate, lte: endDate }
        },
        _sum: { totalAmount: true }
    });
    const totalRevenue = revenueAgg._sum?.totalAmount || 0;

    if (totalRevenue === 0) return 0;

    // Outflows: USAGE, SALE, PRODUCTION_OUT
    const outflowsAgg = await prisma.stockMovement.aggregate({
        where: {
            organizationId: orgId,
            // @ts-ignore - Enums will be checked at runtime or by TS if generated
            type: { in: ['PRODUCTION_OUT', 'USAGE', 'SALE'] },
            createdAt: { gte: startDate, lte: endDate },
            product: { isCmv: true }
        },
        _sum: { totalCost: true }
    });
    const totalCost = outflowsAgg._sum?.totalCost || 0;

    return (totalCost / totalRevenue) * 100;
}

async function calculatePurchasing(costCenterId: string, startDate: Date, endDate: Date): Promise<number> {
    const orgId = await getOrgId(costCenterId);
    if (!orgId) return 0;

    const revenueAgg = await prisma.revenue.aggregate({
        where: { costCenterId, startDate: { gte: startDate } },
        _sum: { totalAmount: true }
    });
    const totalRevenue = revenueAgg._sum.totalAmount || 0;
    if (totalRevenue === 0) return 0;

    const inflowsAgg = await prisma.stockMovement.aggregate({
        where: {
            organizationId: orgId,
            type: 'PURCHASE' as any,
            createdAt: { gte: startDate, lte: endDate },
            product: { isCmv: true }
        },
        _sum: { totalCost: true }
    });
    const totalPurchases = inflowsAgg._sum.totalCost || 0;

    return (totalPurchases / totalRevenue) * 100;
}

async function calculateRecipeCoverage(costCenterId: string): Promise<number> {
    // Determine which Menu Items belong to this Cost Center?
    // Usually linked via MenuCategory -> CostCenter
    // We can filter MenuItems by categories that belong to the CostCenter.

    // Fetch categories for this CostCenter
    const categories = await prisma.menuCategory.findMany({
        where: { costCenterId },
        select: { id: true }
    });

    const categoryIds = categories.map(c => c.id);
    if (categoryIds.length === 0) return 0;

    const totalItems = await prisma.menuItem.count({
        where: {
            menuCategoryId: { in: categoryIds },
            isActive: true
        }
    });

    if (totalItems === 0) return 0;

    const itemsWithRecipe = await prisma.menuItem.count({
        where: {
            menuCategoryId: { in: categoryIds },
            isActive: true,
            recipeId: { not: null }
        }
    });

    return (itemsWithRecipe / totalItems) * 100;
}

async function calculateWastePercent(costCenterId: string, startDate: Date, endDate: Date): Promise<number> {
    const orgId = await getOrgId(costCenterId);
    if (!orgId) return 0;

    const revenueAgg = await prisma.revenue.aggregate({
        where: { costCenterId, startDate: { gte: startDate } },
        _sum: { totalAmount: true }
    });
    const totalRevenue = revenueAgg._sum.totalAmount || 0;
    if (totalRevenue === 0) return 0;

    const wasteAgg = await prisma.stockMovement.aggregate({
        where: {
            organizationId: orgId,
            type: 'LOSS' as any, // or WASTE if enum exists
            createdAt: { gte: startDate, lte: endDate },
            product: { isCmv: true }
        },
        _sum: { totalCost: true }
    });
    const totalWaste = wasteAgg._sum.totalCost || 0;

    return (totalWaste / totalRevenue) * 100;
}

async function calculateRevenue(costCenterId: string, startDate: Date, endDate: Date): Promise<number> {
    const revenueAgg = await prisma.revenue.aggregate({
        where: {
            costCenterId,
            startDate: { gte: startDate, lte: endDate }
        },
        _sum: { totalAmount: true }
    });
    return revenueAgg._sum.totalAmount || 0;
}

async function calculateStockAccuracy(costCenterId: string, startDate: Date, endDate: Date): Promise<number> {
    const sessionsAgg = await prisma.inventorySession.aggregate({
        where: {
            costCenterId,
            status: 'COMPLETED',
            endDate: { gte: startDate, lte: endDate }
        },
        _avg: { precision: true }
    });
    return sessionsAgg._avg.precision || 0;
}
