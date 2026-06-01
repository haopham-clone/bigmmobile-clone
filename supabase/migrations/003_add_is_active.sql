-- Product active/inactive status for deactivating items without deleting

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS products_is_active_idx ON public.products (is_active);
