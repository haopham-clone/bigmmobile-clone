-- Add category column for sidebar navigation grouping

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
