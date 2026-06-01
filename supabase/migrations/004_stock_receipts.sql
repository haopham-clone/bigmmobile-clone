-- Stock In receipt history tables

CREATE TABLE IF NOT EXISTS public.stock_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT,
  note TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.stock_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  previous_quantity INTEGER NOT NULL DEFAULT 0,
  new_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_receipts_created_idx
  ON public.stock_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS stock_receipt_items_receipt_idx
  ON public.stock_receipt_items (receipt_id);

-- Extend stock_logs action enum to include received stock
ALTER TABLE public.stock_logs
  DROP CONSTRAINT IF EXISTS stock_logs_action_check;

ALTER TABLE public.stock_logs
  ADD CONSTRAINT stock_logs_action_check
  CHECK (action IN ('INITIAL_ADD', 'ADJUSTED_UP', 'ADJUSTED_DOWN', 'RECEIVED_STOCK'));

-- RLS
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_receipts_select_authenticated" ON public.stock_receipts;
CREATE POLICY "stock_receipts_select_authenticated"
  ON public.stock_receipts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stock_receipts_insert_authenticated" ON public.stock_receipts;
CREATE POLICY "stock_receipts_insert_authenticated"
  ON public.stock_receipts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stock_receipt_items_select_authenticated" ON public.stock_receipt_items;
CREATE POLICY "stock_receipt_items_select_authenticated"
  ON public.stock_receipt_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stock_receipt_items_insert_authenticated" ON public.stock_receipt_items;
CREATE POLICY "stock_receipt_items_insert_authenticated"
  ON public.stock_receipt_items FOR INSERT
  TO authenticated
  WITH CHECK (true);
