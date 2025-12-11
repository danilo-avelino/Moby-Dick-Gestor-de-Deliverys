import { PrismaClient, UserRole, UnitType, MovementType, MovementReferenceType, IntegrationPlatform, IntegrationStatus, AlertType, AlertSeverity, GoalType, GoalPeriod, SalesChannel, BadgeCategory } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.achievement.deleteMany();
    await prisma.goal.deleteMany();
    await prisma.consumptionAnomaly.deleteMany();
    await prisma.purchaseSuggestion.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.itemPerformance.deleteMany();
    await prisma.menuAnalysis.deleteMany();
    await prisma.cMVSnapshot.deleteMany();
    await prisma.portioningBatch.deleteMany();
    await prisma.portioningProcess.deleteMany();
    await prisma.pricingSuggestion.deleteMany();
    await prisma.recipeIngredient.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.stockBatch.deleteMany();
    await prisma.product.deleteMany();
    await prisma.productCategory.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.syncLog.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.session.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.restaurant.deleteMany();

    // Create Restaurant
    console.log('🏪 Creating restaurant...');
    const restaurant = await prisma.restaurant.create({
        data: {
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
            emailVerified: true,
        },
    });

    // Create Suppliers
    console.log('🚚 Creating suppliers...');
    const supplierMeat = await prisma.supplier.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Frigorífico São Paulo',
            tradeName: 'FSP Carnes',
            cnpj: '98.765.432/0001-10',
            email: 'vendas@fspcarnes.com.br',
            phone: '(11) 3333-4444',
            whatsapp: '(11) 99888-7777',
            city: 'São Paulo',
            state: 'SP',
            paymentTerms: '30 dias',
            rating: 4.5,
        },
    });

    const supplierVegetables = await prisma.supplier.create({
        data: {
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
            name: 'Proteínas',
            description: 'Carnes, frangos e peixes',
        },
    });

    const categoryVegetables = await prisma.productCategory.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Vegetais',
            description: 'Legumes, verduras e hortaliças',
        },
    });

    const categoryDairy = await prisma.productCategory.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Laticínios',
            description: 'Queijos, leite e derivados',
        },
    });

    const categoryGrains = await prisma.productCategory.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Pães e Grãos',
            description: 'Pães, farinhas e grãos',
        },
    });

    const categorySauces = await prisma.productCategory.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Molhos e Condimentos',
            description: 'Molhos, temperos e condimentos',
        },
    });

    const categoryPackaging = await prisma.productCategory.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Embalagens',
            description: 'Embalagens para delivery',
        },
    });

    const categoryBurgers = await prisma.productCategory.create({
        data: {
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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

    // Create Recipes
    console.log('📝 Creating recipes...');

    // Classic Burger
    const classicBurger = await prisma.recipe.create({
        data: {
            restaurantId: restaurant.id,
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

    // Bacon Burger
    const baconBurger = await prisma.recipe.create({
        data: {
            restaurantId: restaurant.id,
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

    // Double Burger
    const doubleBurger = await prisma.recipe.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Hambúrguer Duplo',
            description: 'Dois blends de 180g, queijo cheddar triplo e todos os acompanhamentos',
            productCategoryId: categoryBurgers.id,
            yieldQuantity: 1,
            yieldUnit: 'un',
            currentCost: 22.00,
            costPerUnit: 22.00,
            suggestedPrice: 54.90,
            currentPrice: 49.90,
            packagingCost: 1.30,
            prepTimeMinutes: 12,
            cookTimeMinutes: 10,
        },
    });

    await prisma.recipeIngredient.createMany({
        data: [
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.groundBeef.id, quantity: 360, unit: 'g', costSnapshot: 12.60 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.briocheBun.id, quantity: 1, unit: 'un', costSnapshot: 2.00 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.cheddar.id, quantity: 120, unit: 'g', costSnapshot: 6.60 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.lettuce.id, quantity: 0.15, unit: 'un', costSnapshot: 0.52 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.tomato.id, quantity: 80, unit: 'g', costSnapshot: 0.48 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.onion.id, quantity: 50, unit: 'g', costSnapshot: 0.25 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.specialSauce.id, quantity: 50, unit: 'ml', costSnapshot: 1.25 },
            { recipeId: doubleBurger.id, ingredientType: 'PRODUCT', productId: products.pickles.id, quantity: 30, unit: 'g', costSnapshot: 0.54 },
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
            {
                recipeId: classicBurger.id,
                channel: SalesChannel.DELIVERY_IFOOD,
                recipeCost: 12.50,
                packagingCost: 1.30,
                platformFee: 27,
                suggestedPrice: 34.90,
                currentPrice: 32.90,
                markupPercent: 138,
                marginPercent: 32,
                marginAmount: 10.53,
            },
            {
                recipeId: baconBurger.id,
                channel: SalesChannel.DINE_IN,
                recipeCost: 17.00,
                packagingCost: 0,
                suggestedPrice: 39.90,
                currentPrice: 39.90,
                markupPercent: 135,
                marginPercent: 57,
                marginAmount: 22.90,
            },
            {
                recipeId: baconBurger.id,
                channel: SalesChannel.DELIVERY_IFOOD,
                recipeCost: 17.00,
                packagingCost: 1.30,
                platformFee: 27,
                suggestedPrice: 44.90,
                currentPrice: 42.90,
                markupPercent: 134,
                marginPercent: 30,
                marginAmount: 12.87,
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
            // Ground Beef purchase
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
                createdAt: yesterday,
            },
            // Bacon purchase
            {
                productId: products.bacon.id,
                type: MovementType.IN,
                quantity: 10,
                unit: 'kg',
                costPerUnit: 48.00,
                totalCost: 480.00,
                stockBefore: 5,
                stockAfter: 15,
                referenceType: MovementReferenceType.PURCHASE,
                supplierId: supplierMeat.id,
                invoiceNumber: 'NF-2024-001',
                userId: adminUser.id,
                createdAt: yesterday,
            },
            // Sales consumption
            {
                productId: products.groundBeef.id,
                type: MovementType.OUT,
                quantity: 5.4, // 30 burgers
                unit: 'kg',
                costPerUnit: 35.00,
                totalCost: 189.00,
                stockBefore: 50,
                stockAfter: 44.6,
                referenceType: MovementReferenceType.SALE,
                notes: 'Vendas do dia - 30 hambúrgueres',
                userId: staffUser.id,
                createdAt: today,
            },
        ],
    });

    // Create CMV Snapshots
    console.log('📈 Creating CMV snapshots...');
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const revenue = 1500 + Math.random() * 1000;
        const theoreticalPercent = 28 + Math.random() * 4;
        const realPercent = theoreticalPercent + Math.random() * 3;

        await prisma.cMVSnapshot.create({
            data: {
                restaurantId: restaurant.id,
                date: date,
                revenue: revenue,
                orderCount: Math.floor(40 + Math.random() * 20),
                avgTicket: revenue / (40 + Math.random() * 20),
                theoreticalCogs: revenue * (theoreticalPercent / 100),
                realCogs: revenue * (realPercent / 100),
                theoreticalPercent: theoreticalPercent,
                realPercent: realPercent,
                wastePercent: realPercent - theoreticalPercent,
                wasteAmount: revenue * ((realPercent - theoreticalPercent) / 100),
            },
        });
    }

    // Create Integrations
    console.log('🔗 Creating integrations...');
    await prisma.integration.create({
        data: {
            restaurantId: restaurant.id,
            platform: IntegrationPlatform.IFOOD,
            name: 'iFood - Burger House',
            status: IntegrationStatus.ACTIVE,
            syncFrequencyMinutes: 15,
            lastSyncAt: new Date(),
            externalId: 'ifood-store-123',
        },
    });

    await prisma.integration.create({
        data: {
            restaurantId: restaurant.id,
            platform: IntegrationPlatform.RAPPI,
            name: 'Rappi - Burger House',
            status: IntegrationStatus.PENDING_AUTH,
            syncFrequencyMinutes: 15,
            externalId: 'rappi-store-456',
        },
    });

    // Create Alerts
    console.log('🔔 Creating alerts...');
    await prisma.alert.createMany({
        data: [
            {
                restaurantId: restaurant.id,
                type: AlertType.STOCK_LOW,
                severity: AlertSeverity.HIGH,
                title: 'Estoque Baixo: Bacon Fatiado',
                message: 'O produto Bacon Fatiado está com estoque abaixo do mínimo. Quantidade atual: 15kg, Mínimo: 20kg',
                data: { productId: products.bacon.id, currentStock: 15, reorderPoint: 20 },
                actionUrl: '/products/' + products.bacon.id,
            },
            {
                restaurantId: restaurant.id,
                type: AlertType.CMV_HIGH,
                severity: AlertSeverity.MEDIUM,
                title: 'CMV Acima da Meta',
                message: 'O CMV de ontem foi de 32.5%, acima da meta de 30%. Verifique o desperdício.',
                actionUrl: '/cmv',
            },
            {
                restaurantId: restaurant.id,
                type: AlertType.COST_INCREASE,
                severity: AlertSeverity.LOW,
                title: 'Aumento de Custo: Carne Moída',
                message: 'O preço da Carne Moída aumentou 3% na última compra. Considere atualizar os preços do cardápio.',
                data: { productId: products.groundBeef.id, oldPrice: 35.00, newPrice: 36.00, increasePercent: 2.86 },
                actionUrl: '/recipes',
            },
        ],
    });

    // Create Alert Rules
    console.log('⚙️ Creating alert rules...');
    await prisma.alertRule.createMany({
        data: [
            {
                restaurantId: restaurant.id,
                type: AlertType.STOCK_LOW,
                name: 'Alerta de Estoque Baixo',
                conditions: { threshold: 'min_stock' },
                notificationChannels: ['IN_APP', 'EMAIL'],
                isActive: true,
            },
            {
                restaurantId: restaurant.id,
                type: AlertType.CMV_HIGH,
                name: 'CMV Acima da Meta',
                conditions: { threshold: 35 },
                notificationChannels: ['IN_APP', 'WHATSAPP'],
                isActive: true,
            },
            {
                restaurantId: restaurant.id,
                type: AlertType.COST_INCREASE,
                name: 'Aumento de Custo de Insumo',
                conditions: { percentIncrease: 5 },
                notificationChannels: ['IN_APP'],
                isActive: true,
            },
        ],
    });

    // Create Goals
    console.log('🎯 Creating goals...');
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    await prisma.goal.create({
        data: {
            restaurantId: restaurant.id,
            type: GoalType.REVENUE,
            name: 'Meta de Faturamento Mensal',
            description: 'Atingir R$ 50.000 em vendas no mês',
            targetValue: 50000,
            currentValue: 32500,
            period: GoalPeriod.MONTHLY,
            periodStart: startOfMonth,
            periodEnd: endOfMonth,
            rewardType: 'bonus',
            rewardValue: '500',
            rewardPoints: 1000,
        },
    });

    await prisma.goal.create({
        data: {
            restaurantId: restaurant.id,
            userId: staffUser.id,
            type: GoalType.ORDER_COUNT,
            name: 'Meta de Pedidos do João',
            description: 'Processar 200 pedidos no mês',
            targetValue: 200,
            currentValue: 145,
            period: GoalPeriod.MONTHLY,
            periodStart: startOfMonth,
            periodEnd: endOfMonth,
            rewardType: 'points',
            rewardValue: '500',
            rewardPoints: 500,
        },
    });

    await prisma.goal.create({
        data: {
            restaurantId: restaurant.id,
            type: GoalType.CMV_PERCENT,
            name: 'Manter CMV Abaixo de 30%',
            description: 'Manter o CMV médio mensal abaixo de 30%',
            targetValue: 30,
            currentValue: 31.2,
            period: GoalPeriod.MONTHLY,
            periodStart: startOfMonth,
            periodEnd: endOfMonth,
            rewardPoints: 800,
        },
    });

    // Create Achievements
    console.log('🏆 Creating achievements...');
    await prisma.achievement.createMany({
        data: [
            {
                userId: managerUser.id,
                badgeName: 'Primeiro Mês',
                badgeCategory: BadgeCategory.MILESTONE,
                description: 'Completou o primeiro mês como gerente',
                pointsAwarded: 100,
            },
            {
                userId: staffUser.id,
                badgeName: 'Velocista',
                badgeCategory: BadgeCategory.QUALITY,
                description: 'Processou 50 pedidos em um único dia',
                pointsAwarded: 250,
            },
            {
                userId: staffUser.id,
                badgeName: 'Sem Erros',
                badgeCategory: BadgeCategory.CONSISTENCY,
                description: 'Uma semana inteira sem retrabalho',
                pointsAwarded: 150,
            },
        ],
    });

    // Create Portioning Process
    console.log('🔪 Creating portioning processes...');
    await prisma.portioningProcess.create({
        data: {
            restaurantId: restaurant.id,
            name: 'Porcionamento de Hambúrguer 180g',
            description: 'Dividir carne moída em porções de 180g para hamburgueres',
            rawProductId: products.groundBeef.id,
            yieldPercent: 98,
            wastePercent: 2,
            laborCost: 0.50,
        },
    });

    // Create Purchase Suggestions
    console.log('🛒 Creating purchase suggestions...');
    await prisma.purchaseSuggestion.create({
        data: {
            restaurantId: restaurant.id,
            productId: products.groundBeef.id,
            currentStock: 44.6,
            avgDailyConsumption: 6.5,
            suggestedQuantity: 30,
            suggestedUnit: 'kg',
            reorderPoint: 20,
            leadTimeDays: 1,
            estimatedRunoutDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
            priority: 'MEDIUM',
            reasoning: 'Com base no consumo médio de 6.5kg/dia e estoque atual de 44.6kg, recomendo comprar 30kg para manter 7 dias de estoque.',
            confidence: 0.85,
        },
    });

    await prisma.purchaseSuggestion.create({
        data: {
            restaurantId: restaurant.id,
            productId: products.bacon.id,
            currentStock: 15,
            avgDailyConsumption: 1.8,
            suggestedQuantity: 10,
            suggestedUnit: 'kg',
            reorderPoint: 5,
            leadTimeDays: 1,
            estimatedRunoutDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
            priority: 'LOW',
            reasoning: 'Estoque dentro do normal. Sugiro compra de reposição na próxima semana.',
            confidence: 0.80,
        },
    });

    // ==========================================
    // ORDERS (Work Times Data)
    // ==========================================
    console.log('📦 Creating sample orders...');

    const orderProviders = ['AGILIZONE', 'FOODY', 'IFOOD'];
    const now = new Date();

    // Create 50 sample orders over the last 30 days
    for (let i = 0; i < 50; i++) {
        const daysAgo = Math.floor(Math.random() * 30);

        const orderDateTime = new Date(now);
        orderDateTime.setDate(orderDateTime.getDate() - daysAgo);
        orderDateTime.setHours(10 + Math.floor(Math.random() * 12)); // Between 10am and 10pm
        orderDateTime.setMinutes(Math.floor(Math.random() * 60));

        // Prep time: 5-25 minutes
        const prepMinutes = 5 + Math.random() * 20;
        const readyDateTime = new Date(orderDateTime.getTime() + prepMinutes * 60 * 1000);

        // Pickup time: 2-15 minutes
        const pickupMinutes = 2 + Math.random() * 13;
        const outForDeliveryDateTime = new Date(readyDateTime.getTime() + pickupMinutes * 60 * 1000);

        // Delivery time: 10-40 minutes
        const deliveryMinutes = 10 + Math.random() * 30;
        const deliveredDateTime = new Date(outForDeliveryDateTime.getTime() + deliveryMinutes * 60 * 1000);

        const totalMinutes = prepMinutes + pickupMinutes + deliveryMinutes;

        await prisma.order.create({
            data: {
                restaurantId: restaurant.id,
                externalId: `ORD-${Date.now()}-${i}`,
                logisticsProvider: orderProviders[Math.floor(Math.random() * orderProviders.length)],
                orderDatetime: orderDateTime,
                readyDatetime: readyDateTime,
                outForDeliveryDatetime: outForDeliveryDateTime,
                deliveredDatetime: deliveredDateTime,
                prepTime: Math.round(prepMinutes * 100) / 100,
                pickupTime: Math.round(pickupMinutes * 100) / 100,
                deliveryTime: Math.round(deliveryMinutes * 100) / 100,
                totalTime: Math.round(totalMinutes * 100) / 100,
                customerName: `Cliente ${i + 1}`,
                orderValue: 30 + Math.random() * 150,
                metadata: {
                    source: 'seed',
                    createdAt: new Date().toISOString(),
                },
            },
        });
    }

    console.log('   Created 50 sample orders');

    console.log('✅ Seed completed successfully!');
    console.log('\n📧 Test accounts:');
    console.log('   Admin: admin@burgerhouse.com.br / 123456');
    console.log('   Manager: gerente@burgerhouse.com.br / 123456');
    console.log('   Staff: funcionario@burgerhouse.com.br / 123456');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

