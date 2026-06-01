-- Kiểm Kho: RLS policies, indexes, and updated_at trigger
-- Run once in Supabase SQL Editor (tables products + stock_logs must already exist)

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products (sku);
CREATE INDEX IF NOT EXISTS stock_logs_product_created_idx
  ON public.stock_logs (product_id, created_at DESC);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;

-- products policies
DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "products_insert_authenticated" ON public.products;
CREATE POLICY "products_insert_authenticated"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "products_update_authenticated" ON public.products;
CREATE POLICY "products_update_authenticated"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- stock_logs policies
DROP POLICY IF EXISTS "stock_logs_select_authenticated" ON public.stock_logs;
CREATE POLICY "stock_logs_select_authenticated"
  ON public.stock_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stock_logs_insert_authenticated" ON public.stock_logs;
CREATE POLICY "stock_logs_insert_authenticated"
  ON public.stock_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
