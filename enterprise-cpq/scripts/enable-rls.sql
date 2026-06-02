-- ============================================================
-- RLS Migration: Enable Row Level Security on all tables
-- Run this in your Supabase SQL Editor to fix the
-- "Table publicly accessible" security alert.
--
-- Safe to run multiple times — all statements are idempotent.
-- ============================================================

-- Enable RLS on every table
ALTER TABLE IF EXISTS products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS upload_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS integrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_audit_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS g2_sku_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rate_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS g2_proposals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proposal_versions ENABLE ROW LEVEL SECURITY;

-- Create service-role policies (DROP first so re-runs don't error)
-- products
DROP POLICY IF EXISTS "Service role full access on products"        ON products;
CREATE POLICY "Service role full access on products"
  ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

-- quotes
DROP POLICY IF EXISTS "Service role full access on quotes"          ON quotes;
CREATE POLICY "Service role full access on quotes"
  ON quotes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- quote_items
DROP POLICY IF EXISTS "Service role full access on quote_items"     ON quote_items;
CREATE POLICY "Service role full access on quote_items"
  ON quote_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "Service role full access on orders"          ON orders;
CREATE POLICY "Service role full access on orders"
  ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- users
DROP POLICY IF EXISTS "Service role full access on users"           ON users;
CREATE POLICY "Service role full access on users"
  ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- upload_batches
DROP POLICY IF EXISTS "Service role full access on upload_batches"  ON upload_batches;
CREATE POLICY "Service role full access on upload_batches"
  ON upload_batches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- integrations
DROP POLICY IF EXISTS "Service role full access on integrations"    ON integrations;
CREATE POLICY "Service role full access on integrations"
  ON integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rules
DROP POLICY IF EXISTS "Service role full access on rules"           ON rules;
CREATE POLICY "Service role full access on rules"
  ON rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- quote_audit_log
DROP POLICY IF EXISTS "Service role full access on quote_audit_log" ON quote_audit_log;
CREATE POLICY "Service role full access on quote_audit_log"
  ON quote_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- g2_sku_overrides
DROP POLICY IF EXISTS "Service role full access on g2_sku_overrides" ON g2_sku_overrides;
CREATE POLICY "Service role full access on g2_sku_overrides"
  ON g2_sku_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rate_cards
DROP POLICY IF EXISTS "Service role full access on rate_cards"      ON rate_cards;
CREATE POLICY "Service role full access on rate_cards"
  ON rate_cards FOR ALL TO service_role USING (true) WITH CHECK (true);

-- g2_proposals
DROP POLICY IF EXISTS "Service role full access on g2_proposals"    ON g2_proposals;
CREATE POLICY "Service role full access on g2_proposals"
  ON g2_proposals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- proposal_versions
DROP POLICY IF EXISTS "Service role full access on proposal_versions" ON proposal_versions;
CREATE POLICY "Service role full access on proposal_versions"
  ON proposal_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Verify: list tables with RLS status
-- Run this query after the above to confirm everything is green.
-- ============================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
