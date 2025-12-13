
import { prisma } from 'database';

async function checkProduct() {
    try {
        const products = await prisma.product.findMany({
            where: {
                name: {
                    contains: 'adesivo',
                    mode: 'insensitive'
                }
            }
        });

        console.log('Found products:', JSON.stringify(products, null, 2));

        if (products.length > 0) {
            const p = products[0];
            const reorderPoint = p.manualReorderPoint ?? p.reorderPoint ?? 0;
            console.log(`Checking logic: ReorderPoint=${reorderPoint}, CurrentStock=${p.currentStock}`);
            console.log(`Expected missing: ${reorderPoint - p.currentStock}`);
            console.log(`Should appear in list? ${reorderPoint - p.currentStock > 0}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkProduct();
