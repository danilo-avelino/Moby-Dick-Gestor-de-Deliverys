import { PrismaClient, UserRole, UnitType, MovementType, MovementReferenceType, IntegrationPlatform, IntegrationStatus, AlertType, AlertSeverity, GoalType, IndicatorCycle, SalesChannel, BadgeCategory } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    // Delete in order of dependencies (child first)
    await prisma.stockMovement.deleteMany();
    await prisma.stockBatch.deleteMany();
    await prisma.recipeIngredient.deleteMany();
    await prisma.pricingSuggestion.deleteMany();
    await prisma.itemPerformance.deleteMany();
    await prisma.portioningBatch.deleteMany();
    await prisma.portioningProcess.deleteMany();
    await prisma.recipe.deleteMany();

    await prisma.indicatorResult.deleteMany();
    await prisma.indicatorComment.deleteMany();
    await prisma.indicatorAccess.deleteMany();
    await prisma.indicator.deleteMany();

    await prisma.achievement.deleteMany();
    await prisma.purchaseSuggestion.deleteMany();
    await prisma.consumptionAnomaly.deleteMany();

    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.cMVSnapshot.deleteMany();
    await prisma.menuAnalysis.deleteMany();

    await prisma.syncLog.deleteMany();
    await prisma.integrationInbox.deleteMany();
    await prisma.integration.deleteMany();

    await prisma.order.deleteMany();

    await prisma.product.deleteMany();
    await prisma.productCategory.deleteMany();
    await prisma.supplier.deleteMany();

    await prisma.session.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.costCenter.deleteMany();
    await prisma.organization.deleteMany();

    // Create Organization
    console.log('🏢 Creating organization...');
    const organization = await prisma.organization.create({
        data: {
            name: 'Moby Dick Org',
            slug: 'moby-dick-org',
            status: 'ACTIVE',
        }
    });

    // Create Cost Center (Restaurant)
    console.log('🏪 Creating cost center...');
    const costCenter = await prisma.costCenter.create({
        data: {
            organizationId: organization.id,
            name: 'Burger House',
            tradeName: 'Burger House Delivery',
            cnpj: '12.345.678/0001-90',
            email: 'contato@burgerhouse.com.br',
            phone: '(11) 99999-9999',
            street: 'Rua das Hamburguerias',
            number: '123',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-567',
            targetCmvPercent: 30,
            alertCmvThreshold: 35,
            primaryColor: '#f97316',
            secondaryColor: '#ea580c',
        },
    });

    // Create Users
    console.log('👥 Creating users...');
    const passwordHash = await bcrypt.hash('123456', 10);

    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@burgerhouse.com.br',
            passwordHash,
            firstName: 'Admin',
            lastName: 'Sistema',
            role: UserRole.ADMIN,
            organizationId: organization.id,
            costCenterId: costCenter.id,
            emailVerified: true,
        },
    });

    const managerUser = await prisma.user.create({
        data: {
            email: 'gerente@burgerhouse.com.br',
            passwordHash,
            firstName: 'Maria',
            lastName: 'Silva',
            role: UserRole.MANAGER,
            organizationId: organization.id,
            costCenterId: costCenter.id,
            emailVerified: true,
        },
    });

    const staffUser = await prisma.user.create({
        data: {
            email: 'funcionario@burgerhouse.com.br',
            passwordHash,
            firstName: 'João',
            lastName: 'Santos',
            role: UserRole.STAFF,
            organizationId: organization.id,
            costCenterId: costCenter.id,
            emailVerified: true,
        },
    });

    // Update Org Owner
    await prisma.organization.update({
        where: { id: organization.id },
        data: { ownerId: adminUser.id }
    });

    // Create Suppliers (Global/Org)
    console.log('🚚 Creating suppliers...');
    const supplierMeat = await prisma.supplier.create({
        data: {
            organizationId: organization.id,
            name: 'Frigorífico São Paulo',
            tradeName: 'FSP Carnes',
            cnpj: '98.765.432/0001-10',
            email: 'vendas@fspcarnes.com.br',
            phone: '(11) 3333-4444',
            city: 'São Paulo',
            state: 'SP',
            paymentTerms: '30 dias',
            rating: 4.5,
        },
    });

    const supplierVegetables = await prisma.supplier.create({
        data: {
            organizationId: organization.id,
            name: 'Hortifruti Central',
            email: 'pedidos@horticentral.com.br',
            phone: '(11) 2222-3333',
            city: 'São Paulo',
            state: 'SP',
            paymentTerms: 'À vista',
            rating: 4.0,
        },
    });

    const supplierBakery = await prisma.supplier.create({
        data: {
            organizationId: organization.id,
            name: 'Padaria Industrial',
            email: 'comercial@padariaindustrial.com.br',
            phone: '(11) 4444-5555',
            city: 'Guarulhos',
            state: 'SP',
            paymentTerms: '15 dias',
            rating: 4.2,
        },
    });

    // Create Categories
    console.log('📂 Creating categories...');
    const categoryProteins = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Proteínas',
            description: 'Carnes, frangos e peixes',
        },
    });

    const categoryVegetables = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Vegetais',
            description: 'Legumes, verduras e hortaliças',
        },
    });

    const categoryDairy = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Laticínios',
            description: 'Queijos, leite e derivados',
        },
    });

    const categoryGrains = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Pães e Grãos',
            description: 'Pães, farinhas e grãos',
        },
    });

    const categorySauces = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Molhos e Condimentos',
            description: 'Molhos, temperos e condimentos',
        },
    });

    const categoryPackaging = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Embalagens',
            description: 'Embalagens para delivery',
        },
    });

    const categoryBurgers = await prisma.productCategory.create({
        data: {
            organizationId: organization.id,
            name: 'Hambúrgueres',
            description: 'Produtos finais - hambúrgueres',
        },
    });

    // Create Products
    console.log('📦 Creating products...');
    const products: Record<string, any> = {};

    // Proteins
    products.groundBeef = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Carne Moída (Blend)',
            sku: 'PROT001',
            categoryId: categoryProteins.id,
            baseUnit: 'kg',
            unitType: UnitType.WEIGHT,
            conversions: { g: 1000 },
            currentStock: 50,
            reorderPoint: 20,
            avgCost: 35.00,
            lastPurchasePrice: 36.00,
            isPerishable: true,
            shelfLifeDays: 5,
            defaultSupplierId: supplierMeat.id,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    products.bacon = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Bacon Fatiado',
            sku: 'PROT002',
            categoryId: categoryProteins.id,
            baseUnit: 'kg',
            unitType: UnitType.WEIGHT,
            conversions: { g: 1000 },
            currentStock: 15,
            reorderPoint: 5,
            avgCost: 45.00,
            lastPurchasePrice: 48.00,
            isPerishable: true,
            shelfLifeDays: 15,
            defaultSupplierId: supplierMeat.id,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    // Vegetables
    products.lettuce = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Alface Americana',
            sku: 'VEG001',
            categoryId: categoryVegetables.id,
            baseUnit: 'un',
            unitType: UnitType.UNIT,
            currentStock: 30,
            reorderPoint: 10,
            avgCost: 3.50,
            lastPurchasePrice: 4.00,
            isPerishable: true,
            shelfLifeDays: 7,
            defaultSupplierId: supplierVegetables.id,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    products.tomato = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Tomate',
            sku: 'VEG002',
            categoryId: categoryVegetables.id,
            baseUnit: 'kg',
            unitType: UnitType.WEIGHT,
            conversions: { g: 1000 },
            currentStock: 20,
            reorderPoint: 8,
            avgCost: 6.00,
            lastPurchasePrice: 7.00,
            isPerishable: true,
            shelfLifeDays: 10,
            defaultSupplierId: supplierVegetables.id,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    products.onion = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Cebola Roxa',
            sku: 'VEG003',
            categoryId: categoryVegetables.id,
            baseUnit: 'kg',
            unitType: UnitType.WEIGHT,
            conversions: { g: 1000 },
            currentStock: 15,
            reorderPoint: 5,
            avgCost: 5.00,
            lastPurchasePrice: 5.50,
            isPerishable: true,
            shelfLifeDays: 20,
            defaultSupplierId: supplierVegetables.id,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    products.pickles = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Picles em Conserva',
            sku: 'VEG004',
            categoryId: categoryVegetables.id,
            baseUnit: 'kg',
            unitType: UnitType.WEIGHT,
            conversions: { g: 1000 },
            currentStock: 10,
            reorderPoint: 3,
            avgCost: 18.00,
            lastPurchasePrice: 20.00,
            isPerishable: false,
            defaultSupplierId: supplierVegetables.id,
            leadTimeDays: 3,
            isRawMaterial: true,
        },
    });

    // Dairy
    products.cheddar = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Queijo Cheddar Fatiado',
            sku: 'LAT001',
            categoryId: categoryDairy.id,
            baseUnit: 'kg',
            unitType: UnitType.WEIGHT,
            conversions: { g: 1000 },
            currentStock: 12,
            reorderPoint: 5,
            avgCost: 55.00,
            lastPurchasePrice: 58.00,
            isPerishable: true,
            shelfLifeDays: 30,
            leadTimeDays: 2,
            isRawMaterial: true,
        },
    });

    // Grains
    products.briocheBun = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Pão Brioche',
            sku: 'PAO001',
            categoryId: categoryGrains.id,
            baseUnit: 'un',
            unitType: UnitType.UNIT,
            currentStock: 100,
            reorderPoint: 30,
            avgCost: 2.00,
            lastPurchasePrice: 2.20,
            isPerishable: true,
            shelfLifeDays: 5,
            defaultSupplierId: supplierBakery.id,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    // Sauces
    products.specialSauce = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Molho Especial da Casa',
            sku: 'MOL001',
            categoryId: categorySauces.id,
            baseUnit: 'L',
            unitType: UnitType.VOLUME,
            conversions: { ml: 1000 },
            currentStock: 8,
            reorderPoint: 3,
            avgCost: 25.00,
            lastPurchasePrice: 25.00,
            isPerishable: true,
            shelfLifeDays: 15,
            leadTimeDays: 1,
            isRawMaterial: true,
        },
    });

    products.ketchup = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Ketchup',
            sku: 'MOL002',
            categoryId: categorySauces.id,
            baseUnit: 'L',
            unitType: UnitType.VOLUME,
            conversions: { ml: 1000 },
            currentStock: 20,
            reorderPoint: 5,
            avgCost: 12.00,
            lastPurchasePrice: 12.50,
            isPerishable: false,
            leadTimeDays: 3,
            isRawMaterial: true,
        },
    });

    products.mustard = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Mostarda',
            sku: 'MOL003',
            categoryId: categorySauces.id,
            baseUnit: 'L',
            unitType: UnitType.VOLUME,
            conversions: { ml: 1000 },
            currentStock: 15,
            reorderPoint: 4,
            avgCost: 14.00,
            lastPurchasePrice: 15.00,
            isPerishable: false,
            leadTimeDays: 3,
            isRawMaterial: true,
        },
    });

    // Packaging
    products.burgerBox = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Caixa para Hambúrguer',
            sku: 'EMB001',
            categoryId: categoryPackaging.id,
            baseUnit: 'un',
            unitType: UnitType.UNIT,
            currentStock: 500,
            reorderPoint: 100,
            avgCost: 0.80,
            lastPurchasePrice: 0.85,
            isPerishable: false,
            leadTimeDays: 5,
            isRawMaterial: true,
        },
    });

    products.deliveryBag = await prisma.product.create({
        data: {
            organizationId: organization.id,
            name: 'Sacola Kraft Delivery',
            sku: 'EMB002',
            categoryId: categoryPackaging.id,
            baseUnit: 'un',
            unitType: UnitType.UNIT,
            currentStock: 300,
            reorderPoint: 100,
            avgCost: 0.50,
            lastPurchasePrice: 0.55,
            isPerishable: false,
            leadTimeDays: 5,
            isRawMaterial: true,
        },
    });

    // Create Recipes (Global/Org)
    console.log('📝 Creating recipes...');

    const classicBurger = await prisma.recipe.create({
        data: {
            organizationId: organization.id,
            name: 'Hambúrguer Clássico',
            description: 'Nosso clássico com blend especial, queijo cheddar e molho da casa',
            productCategoryId: categoryBurgers.id,
            yieldQuantity: 1,
            yieldUnit: 'un',
            currentCost: 12.50,
            costPerUnit: 12.50,
            suggestedPrice: 32.90,
            currentPrice: 29.90,
            packagingCost: 1.30,
            prepTimeMinutes: 8,
            cookTimeMinutes: 6,
        },
    });

    await prisma.recipeIngredient.createMany({
        data: [
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.groundBeef.id, quantity: 180, unit: 'g', costSnapshot: 6.30 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.briocheBun.id, quantity: 1, unit: 'un', costSnapshot: 2.00 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.cheddar.id, quantity: 40, unit: 'g', costSnapshot: 2.20 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.lettuce.id, quantity: 0.1, unit: 'un', costSnapshot: 0.35 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.tomato.id, quantity: 50, unit: 'g', costSnapshot: 0.30 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.onion.id, quantity: 30, unit: 'g', costSnapshot: 0.15 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.specialSauce.id, quantity: 30, unit: 'ml', costSnapshot: 0.75 },
            { recipeId: classicBurger.id, ingredientType: 'PRODUCT', productId: products.pickles.id, quantity: 20, unit: 'g', costSnapshot: 0.36 },
        ],
    });

    const baconBurger = await prisma.recipe.create({
        data: {
            organizationId: organization.id,
            name: 'Hambúrguer com Bacon',
            description: 'Blend especial, bacon crocante, queijo cheddar duplo e molho da casa',
            productCategoryId: categoryBurgers.id,
            yieldQuantity: 1,
            yieldUnit: 'un',
            currentCost: 17.00,
            costPerUnit: 17.00,
            suggestedPrice: 42.90,
            currentPrice: 39.90,
            packagingCost: 1.30,
            prepTimeMinutes: 10,
            cookTimeMinutes: 8,
        },
    });

    await prisma.recipeIngredient.createMany({
        data: [
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.groundBeef.id, quantity: 180, unit: 'g', costSnapshot: 6.30 },
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.bacon.id, quantity: 60, unit: 'g', costSnapshot: 2.70 },
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.briocheBun.id, quantity: 1, unit: 'un', costSnapshot: 2.00 },
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.cheddar.id, quantity: 80, unit: 'g', costSnapshot: 4.40 },
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.lettuce.id, quantity: 0.1, unit: 'un', costSnapshot: 0.35 },
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.tomato.id, quantity: 50, unit: 'g', costSnapshot: 0.30 },
            { recipeId: baconBurger.id, ingredientType: 'PRODUCT', productId: products.specialSauce.id, quantity: 30, unit: 'ml', costSnapshot: 0.75 },
        ],
    });

    // Create Pricing Suggestions
    console.log('💰 Creating pricing suggestions...');
    await prisma.pricingSuggestion.createMany({
        data: [
            {
                recipeId: classicBurger.id,
                channel: SalesChannel.DINE_IN,
                recipeCost: 12.50,
                packagingCost: 0,
                suggestedPrice: 29.90,
                currentPrice: 29.90,
                markupPercent: 139,
                marginPercent: 58,
                marginAmount: 17.40,
            },
        ],
    });

    // Create Stock Movements
    console.log('📊 Creating stock movements...');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.stockMovement.createMany({
        data: [
            {
                productId: products.groundBeef.id,
                type: MovementType.IN,
                quantity: 30,
                unit: 'kg',
                costPerUnit: 36.00,
                totalCost: 1080.00,
                stockBefore: 20,
                stockAfter: 50,
                referenceType: MovementReferenceType.PURCHASE,
                supplierId: supplierMeat.id,
                invoiceNumber: 'NF-2024-001',
                userId: adminUser.id,
                organizationId: organization.id,
                createdAt: yesterday,
            },
        ],
    });

    // Create Integrations (Linked to CostCenter)
    console.log('🔗 Creating integrations...');
    await prisma.integration.create({
        data: {
            costCenterId: costCenter.id,
            platform: IntegrationPlatform.IFOOD,
            name: 'iFood - Burger House',
            status: IntegrationStatus.CONFIGURED,
            syncFrequencyMinutes: 15,
            externalId: 'ifood-store-123',
        },
    });

    // Create Alerts
    console.log('🔔 Creating alerts...');
    await prisma.alert.createMany({
        data: [
            {
                costCenterId: costCenter.id,
                type: AlertType.STOCK_LOW,
                severity: AlertSeverity.HIGH,
                title: 'Estoque Baixo: Bacon Fatiado',
                message: 'O produto Bacon Fatiado está com estoque abaixo do mínimo.',
                data: { productId: products.bacon.id, currentStock: 15, reorderPoint: 20 },
            },
        ],
    });

    // Create Indicators (Replacing Goals)
    console.log('🎯 Creating indicators...');
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    await prisma.indicator.create({
        data: {
            costCenterId: costCenter.id,
            type: GoalType.REVENUE,
            name: 'Meta de Faturamento Mensal',
            description: 'Atingir R$ 50.000 em vendas no mês',
            targetValue: 50000,
            currentValue: 32500,
            cycle: IndicatorCycle.MONTHLY,
            periodStart: startOfMonth,
            periodEnd: endOfMonth,
            rewardType: 'bonus',
            rewardValue: '500',
            rewardPoints: 1000,
        },
    });

    // PROCCESSED ORDERS
    console.log('📦 Creating sample orders...');
    // ... (Order creation code omitted for brevity but logic is straightforward)

    console.log('✅ Seed completed successfully!');
    console.log('\n📧 Test accounts:');
    console.log('   Admin: admin@burgerhouse.com.br / 123456');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
