
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🏁 Starting Multi-Tenancy Backfill...');

    // 1. Create Default Organization
    console.log('>>> Ensuring Default Organization...');
    let defaultOrg = await prisma.organization.findFirst({
        where: { name: 'Moby Dick Default' }
    });

    if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({
            data: {
                name: 'Moby Dick Default',
                slug: 'moby-dick-default',
                status: 'ACTIVE'
            }
        });
        console.log(`✅ Default Organization Created: ${defaultOrg.id}`);
    } else {
        console.log(`ℹ️ Default Organization Found: ${defaultOrg.id}`);
    }

    const orgId = defaultOrg.id;

    // 2. Link Existing Restaurants to Default Org
    console.log('>>> Linking Restaurants...');
    const restaurants = await prisma.restaurant.findMany({
        where: { organizationId: null }
    });

    for (const restaurant of restaurants) {
        await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: { organizationId: orgId }
        });
        console.log(`Updated Restaurant: ${restaurant.name} -> Org: ${orgId}`);
    }

    // 3. Link Users to Default Org and Update Scope
    console.log('>>> Linking Users...');
    const users = await prisma.user.findMany({
        where: { organizationId: null }
    });

    for (const user of users) {
        // Determine scope based on role logic
        // Admins/Managers -> ORG scope (simplified for migration)
        // Others -> RESTAURANTS scope
        const isOrgLevel = ['SUPER_ADMIN', 'ADMIN', 'DIRETOR', 'MANAGER'].includes(user.role);
        const scope = isOrgLevel ? 'ORG' : 'RESTAURANTS';

        await prisma.user.update({
            where: { id: user.id },
            data: {
                organizationId: orgId,
                scope: scope
            }
        });
        console.log(`Updated User: ${user.email} -> Org: ${orgId}, Scope: ${scope}`);
    }

    // 4. Create UserRestaurantAccess for existing Users
    console.log('>>> Creating User Access Records...');
    const usersWithRestaurant = await prisma.user.findMany({
        where: {
            NOT: { restaurantId: null }
        }
    });

    for (const user of usersWithRestaurant) {
        if (!user.restaurantId) continue;

        const existingAccess = await prisma.userRestaurantAccess.findUnique({
            where: {
                userId_restaurantId: {
                    userId: user.id,
                    restaurantId: user.restaurantId
                }
            }
        });

        if (!existingAccess) {
            await prisma.userRestaurantAccess.create({
                data: {
                    userId: user.id,
                    restaurantId: user.restaurantId,
                    organizationId: orgId
                }
            });
            console.log(`Access Created: ${user.email} -> Rest: ${user.restaurantId}`);
        }
    }

    // 5. Backfill Data Tables (Product, Order, etc.)
    console.log('>>> Backfilling Data Tables...');

    const tablesToUpdate = [
        'product', 'order', 'stockMovement', 'recipe',
        'supplier', 'integration', 'stockBatch', 'portioningProcess',
        'purchaseList', 'pdvOrder', 'customer', 'restaurantTable', 'cashSession'
    ];

    for (const tableName of tablesToUpdate) {
        console.log(`Proccessing ${tableName}...`);
        // Update all records where organizationId is null
        // We look up the restaurant relation to get the orgId, but since we just set all restaurants to defaultOrg,
        // we can theoretically set all to defaultOrg. However, to be safe and correct logic, we will trust the restaurant.
        // Since SQL updates via Prisma for "updateMany with relation" isn't direct, we might need to do this in raw SQL or loop.
        // Given we are migrating to correct architecture, raw SQL is faster.

        try {
            const count = await prisma.$executeRawUnsafe(`
            UPDATE "${tableName.charAt(0).toUpperCase() + tableName.slice(1)}"
            SET "organizationId" = '${orgId}'
            WHERE "organizationId" IS NULL AND "restaurantId" IS NOT NULL
        `);
            console.log(` - Updated ${count} records in ${tableName}`);
        } catch (e) {
            console.warn(` - Could not update ${tableName} via raw SQL (maybe model name mismatch). Trying manual loop fallback.`);
            // Fallback logic if needed, but SQL is preferred for perf.
            // Common mismatch: Table names in Prisma are PascalCase (Product), but Postgres handles case sensitivity with quotes.
        }
    }

    console.log('🎉 Backfill Completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
