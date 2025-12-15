-- Enable RLS on core multi-tenant tables
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Recipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecipeCategory" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY; -- Check if Order table exists in schema first
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockBatch" ENABLE ROW LEVEL SECURITY;

-- Function to get current user's organizationId
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS text AS $$
DECLARE
  v_org_id text;
BEGIN
  -- Attempt to get from session variable (if set by middleware)
  -- This requires the app to run `SET app.current_organization_id = '...'` on connection
  v_org_id := current_setting('app.current_organization_id', true);
  
  -- Fallback: lookup based on auth.uid() if using Supabase Auth with "User" table link
  IF v_org_id IS NULL THEN
    SELECT "organizationId" INTO v_org_id
    FROM "User"
    WHERE id = auth.uid()::text; 
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLICIES
CREATE POLICY "Tenant Isolation Policy" ON "Product"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "StockMovement"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "ProductCategory"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "Recipe"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "RecipeCategory"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "Supplier"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "Restaurant"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "StockBatch"
USING ("organizationId" = current_user_org_id());

CREATE POLICY "Tenant Isolation Policy" ON "Customer"
USING ("organizationId" = current_user_org_id());
