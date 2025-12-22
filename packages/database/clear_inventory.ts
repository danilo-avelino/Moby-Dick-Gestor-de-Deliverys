
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearInventory() {
    // Admin cost center from previous steps
    const costCenterId = 'cmjdm7wmg000262uy2ykatoue';

    console.log('Clearing inventory for cost center:', costCenterId);

    const count = await prisma.inventorySession.deleteMany({
        where: { costCenterId: costCenterId }
    });

    console.log('Deleted sessions:', count.count);
}

clearInventory()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
