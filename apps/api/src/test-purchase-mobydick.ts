import { prisma } from 'database';
import { PurchaseListService } from './services/purchase-list.service';

async function run() {
    console.log('Starting verification...');
    try {
        const product = await prisma.product.findFirst({
            where: { name: { contains: 'ADESIVO MOBYDICK' } }
        });

        if (!product) {
            console.error('FALHA: Produto ADESIVO MOBYDICK nao encontrado no banco.');
            return;
        }

        console.log(`Produto: ${product.name}, Estoque: ${product.currentStock}, Ponto Reposicao Manual: ${product.manualReorderPoint}`);

        const user = await prisma.user.findFirst({ where: { restaurantId: product.restaurantId } });
        if (!user) {
            console.error('FALHA: Usuario nao encontrado.');
            return;
        }

        // Using 'MANUAL' as any to avoid import issues if type not exported
        const list = await PurchaseListService.generatePurchaseList(
            product.restaurantId,
            user.id,
            'MANUAL' as any,
            'Teste Automatizado - Adesivo Mobydick'
        );

        if (list) {
            console.log(`Lista gerada com ID: ${list.id}`);
            const item = list.items.find((i: any) => i.productId === product.id);
            if (item) {
                console.log(`SUCESSO: Item '${item.productNameSnapshot}' esta na lista.`);
                console.log(`Qtd Sugerida: ${item.suggestedQuantity}`);
            } else {
                console.log(`FALHA: Lista gerada mas o item nao esta nela.`);
            }
        } else {
            console.log(`FALHA: Nenhuma lista foi gerada. O sistema acha que nao ha itens para comprar.`);
        }

    } catch (e) {
        console.error('ERRO DE EXECUCAO:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
