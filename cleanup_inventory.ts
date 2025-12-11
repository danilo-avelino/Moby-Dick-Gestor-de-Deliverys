
import { prisma } from 'database';

async function main() {
    const deleted = await prisma.inventorySession.deleteMany({
        where: { status: 'OPEN' }
    });
    console.log(`Deleted ${deleted.count} open inventory sessions.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
