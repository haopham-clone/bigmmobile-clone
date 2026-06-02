-- Source metadata for idempotent crawler imports and public product variations

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_product_url TEXT,
  ADD COLUMN IF NOT EXISTS source_variation_id BIGINT,
  ADD COLUMN IF NOT EXISTS source_sku TEXT,
  ADD COLUMN IF NOT EXISTS variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS products_source_product_url_idx
  ON public.products (source_product_url);

CREATE UNIQUE INDEX IF NOT EXISTS products_source_variation_id_unique_idx
  ON public.products (source_variation_id)
  WHERE source_variation_id IS NOT NULL;
