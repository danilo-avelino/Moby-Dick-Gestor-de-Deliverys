
import { PrismaClient } from 'database';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    console.log('🏁 Iniciando Teste de Multi-Tenancy...\n');

    // 1. Setup Tenant A
    console.log('>>> Criando Tenant A (Burger King)...');
    const restaurantA = await prisma.restaurant.create({
        data: { name: `Burger King ${uuidv4().slice(0, 4)}`, cnpj: uuidv4() }
    });
    console.log(`✅ Tenant A criado: ${restaurantA.id}`);

    const userA = await prisma.user.create({
        data: {
            email: `adminA_${uuidv4().slice(0, 4)}@bk.com`,
            passwordHash: 'dummy',
            firstName: 'Admin',
            lastName: 'A',
            role: 'ADMIN',
            restaurantId: restaurantA.id
        }
    });
    console.log(`✅ User A criado: ${userA.id} (RestaurantId: ${userA.restaurantId})`);

    // Create Product for A
    const productA = await prisma.product.create({
        data: {
            name: 'Whopper',
            restaurantId: restaurantA.id,
            baseUnit: 'un',
            currentStock: 100
        }
    });
    console.log(`✅ Produto A criado: ${productA.name} (${productA.id})\n`);


    // 2. Setup Tenant B
    console.log('>>> Criando Tenant B (McDonalds)...');
    const restaurantB = await prisma.restaurant.create({
        data: { name: `McDonalds ${uuidv4().slice(0, 4)}`, cnpj: uuidv4() }
    });
    console.log(`✅ Tenant B criado: ${restaurantB.id}`);

    const userB = await prisma.user.create({
        data: {
            email: `adminB_${uuidv4().slice(0, 4)}@mc.com`,
            passwordHash: 'dummy',
            firstName: 'Admin',
            lastName: 'B',
            role: 'ADMIN',
            restaurantId: restaurantB.id
        }
    });
    console.log(`✅ User B criado: ${userB.id} (RestaurantId: ${userB.restaurantId})`);

    // Create Product for B
    const productB = await prisma.product.create({
        data: {
            name: 'Big Mac',
            restaurantId: restaurantB.id,
            baseUnit: 'un',
            currentStock: 50
        }
    });
    console.log(`✅ Produto B criado: ${productB.name} (${productB.id})\n`);


    // 3. Testing Isolation
    console.log('>>> TESTE 1: User A listando SEUS produtos');
    const productsForA = await prisma.product.findMany({
        where: { restaurantId: userA.restaurantId! }
    });
    console.log(`Items encontrados: ${productsForA.length}`);
    productsForA.forEach(p => console.log(` - ${p.name} (ID: ${p.id})`));

    const vazouDadosA = productsForA.some(p => p.id === productB.id);
    if (vazouDadosA) console.error('❌ ERRO: User A viu produto do User B!');
    else console.log('✅ SUCESSO: User A viu apenas seus produtos.');


    console.log('\n>>> TESTE 2: User B listando SEUS produtos');
    const productsForB = await prisma.product.findMany({
        where: { restaurantId: userB.restaurantId! }
    });
    console.log(`Items encontrados: ${productsForB.length}`);
    productsForB.forEach(p => console.log(` - ${p.name} (ID: ${p.id})`));

    const vazouDadosB = productsForB.some(p => p.id === productA.id);
    if (vazouDadosB) console.error('❌ ERRO: User B viu produto do User A!');
    else console.log('✅ SUCESSO: User B viu apenas seus produtos.');


    console.log('\n>>> TESTE 3: User B tentando acessar Produto A diretamente (IDOR)');
    // Simulando GET /api/products/:id onde o backend faz: where: { id: params.id, restaurantId: user.restaurantId }
    const maliciousQuery = await prisma.product.findFirst({
        where: {
            id: productA.id, // ID do produto do concorrente
            restaurantId: userB.restaurantId! // Contexto do usuário logado
        }
    });

    if (maliciousQuery) {
        console.error('❌ ERRO CRÍTICO: User B conseguiu acessar dados do Produto A!');
        console.log(maliciousQuery);
    } else {
        console.log('✅ SUCESSO: Acesso negado. User B não encontrou Produto A no seu escopo.');
    }

    console.log('\n🎉 Teste de auditoria concluído.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
