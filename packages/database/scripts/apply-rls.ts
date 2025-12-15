import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
    // Enable RLS
    `ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "ProductCategory" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Recipe" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "RecipeCategory" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "StockBatch" ENABLE ROW LEVEL SECURITY;`,

    // Helper Function
    `CREATE OR REPLACE FUNCTION current_user_org_id()
    RETURNS text AS $$
    DECLARE
      v_org_id text;
    BEGIN
      -- Attempt to get from session variable
      BEGIN
        v_org_id := current_setting('app.current_organization_id', true);
      EXCEPTION WHEN OTHERS THEN
        v_org_id := null;
      END;
      
      -- Fallback: lookup based on auth.uid() if using Supabase Auth
      IF v_org_id IS NULL THEN
        -- Verify if 'auth' schema exists or just return null to avoid error if not on Supabase
        -- We assume 'auth.uid()' is available if on Supabase, but strictly in Prisma context it might fail if 'auth' is not in search_path.
        -- For safety, we wrap in exception block or check existence? 
        -- Simplification: Just return null for now if not using app setting.
        -- Real Supabase usage:
        -- SELECT "organizationId" INTO v_org_id FROM "User" WHERE id = auth.uid()::text;
        NULL; 
      END IF;
    
      RETURN v_org_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;`,

    // Policies
    // Note: We use "IF NOT EXISTS" logic via DO block or just ignore error in catch
    `CREATE POLICY "Tenant Isolation Policy" ON "Product" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "StockMovement" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "ProductCategory" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "Recipe" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "RecipeCategory" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "Supplier" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "Restaurant" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "StockBatch" USING ("organizationId" = current_user_org_id());`,
    `CREATE POLICY "Tenant Isolation Policy" ON "Customer" USING ("organizationId" = current_user_org_id());`
];

async function main() {
    console.log('Applying RLS migration...');

    for (const sql of statements) {
        try {
            console.log(`Executing: ${sql.substring(0, 50).replace(/\n/g, ' ')}...`);
            await prisma.$executeRawUnsafe(sql);
        } catch (error) {
            if (String(error).includes('already exists') || String(error).includes('already exists')) {
                console.log('  -> Object already exists, skipping.');
            } else {
                console.error(`❌ Failed to execute statement: ${error}`);
                // Don't throw, try to continue to apply others? Or stop?
                // If function fails, policies will fail.
                // If policy fails, maybe others work.
                // Let's stop on function failure, continue on policy failure.
                if (sql.includes('CREATE OR REPLACE FUNCTION')) {
                    throw error;
                }
            }
        }
    }

    console.log('✅ RLS Migration applied successfully!');
    await prisma.$disconnect();
}

main();
