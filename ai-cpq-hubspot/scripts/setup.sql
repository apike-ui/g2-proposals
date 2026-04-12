-- ============================================================
-- AI CPQ + HubSpot - Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  category VARCHAR(255),
  unit VARCHAR(100) DEFAULT 'each',
  hubspot_product_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(500),
  customer_email VARCHAR(255),
  customer_company VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  notes TEXT,
  ai_summary TEXT,
  hubspot_deal_id VARCHAR(255),
  total_amount DECIMAL(10,2) DEFAULT 0,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_email ON quotes(customer_email);

-- Quote items table
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled')),
  customer_name VARCHAR(500),
  customer_email VARCHAR(255),
  customer_company VARCHAR(500),
  shipping_address TEXT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  hubspot_deal_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders(quote_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (optional but recommended)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (used by the API)
CREATE POLICY "Service role full access on products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on quotes" ON quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on quote_items" ON quote_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on orders" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Sample data (optional - remove if not needed)
INSERT INTO products (sku, name, description, price, category, unit) VALUES
  ('SW-ENT-001', 'Enterprise Software License', 'Annual enterprise license for up to 50 users. Includes all modules and priority support.', 4999.00, 'Software', 'license/year'),
  ('SW-PRO-001', 'Professional Software License', 'Annual professional license for up to 10 users.', 1499.00, 'Software', 'license/year'),
  ('SVC-IMP-001', 'Implementation Services', 'Professional implementation and configuration services.', 1500.00, 'Services', 'day'),
  ('SVC-TRN-001', 'Training Services', 'On-site or remote training for your team.', 800.00, 'Services', 'day'),
  ('SVC-SUP-001', 'Premium Support Plan', '24/7 phone and email support with 4-hour SLA.', 2400.00, 'Support', 'year'),
  ('HW-MOD-A', 'Hardware Module A', 'High-performance compute module for data processing.', 299.99, 'Hardware', 'each'),
  ('HW-MOD-B', 'Hardware Module B', 'Storage expansion module, 2TB capacity.', 449.99, 'Hardware', 'each'),
  ('CLOUD-STG-1TB', 'Cloud Storage - 1TB', 'Secure cloud storage with redundancy and encryption.', 99.00, 'Cloud', 'month'),
  ('API-ACCESS', 'API Access License', 'Full API access for integrations and custom development.', 599.00, 'Software', 'year'),
  ('MAINT-ANNUAL', 'Annual Maintenance', 'Software updates, patches, and bug fixes for one year.', 799.00, 'Support', 'year')
ON CONFLICT (sku) DO NOTHING;
