
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Starting Fix Backfill for remaining tables...');

    // 1. Get Default Org ID
    const defaultOrg = await prisma.organization.findFirst({
        where: { name: 'Moby Dick Default' }
    });

    if (!defaultOrg) {
        console.error('❌ Default Org not found! Run seed-multitenant.ts first.');
        return;
    }
    const orgId = defaultOrg.id;
    console.log(`Using Org ID: ${orgId}`);

    // Helper to update by batches to avoid timeouts if many records (though in dev it's small)
    async function updateTable(modelName: string, delegate: any) {
        console.log(`>>> Updating ${modelName}...`);
        // We need to look up records that have restaurantId but no organizationId
        // Since updateMany doesn't support relation filtering in simple cases, we can try to fetch IDs first or just update based on logic.
        // Ideally we update based on restaurant.organizationId, but since we set all restaurants to defaultOrg, we can blindly set orgId here.

        // Check if model has updateMany and organizationId field
        try {
            const result = await delegate.updateMany({
                where: {
                    organizationId: null,
                    // Assuming all these tables have restaurantId. Check schema if fails.
                    NOT: { restaurantId: null }
                },
                data: {
                    organizationId: orgId
                }
            });
            console.log(` ✅ Updated ${result.count} records in ${modelName}`);
        } catch (e: any) {
            console.warn(` ⚠️ Failed to update ${modelName}: ${e.message}`);
        }
    }

    // List of models that failed in raw SQL
    await updateTable('StockBatch', prisma.stockBatch);
    await updateTable('PortioningProcess', prisma.portioningProcess);
    await updateTable('PurchaseList', prisma.purchaseList);
    await updateTable('PdvOrder', prisma.pdvOrder);
    await updateTable('Customer', prisma.customer);
    await updateTable('RestaurantTable', prisma.restaurantTable);
    await updateTable('CashSession', prisma.cashSession);

    // Bonus checks
    await updateTable('StockRequest', prisma.stockRequest);
    await updateTable('StockRequestTemplate', prisma.stockRequestTemplate);

    console.log('🎉 Fix Completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
