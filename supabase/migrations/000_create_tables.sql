-- Base schema for Kiểm Kho (run before 001_inventory_rls.sql if tables do not exist)

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  brand TEXT NOT NULL,
  model_type TEXT,
  model TEXT NOT NULL,
  storage_ram TEXT,
  color TEXT,
  condition TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  sku TEXT NOT NULL UNIQUE,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('INITIAL_ADD', 'ADJUSTED_UP', 'ADJUSTED_DOWN')),
  quantity_changed INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
