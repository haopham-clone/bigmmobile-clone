-- Indexes for paginated product lists and filters

CREATE INDEX IF NOT EXISTS products_updated_at_idx ON public.products (updated_at DESC);
CREATE INDEX IF NOT EXISTS products_active_category_idx ON public.products (is_active, category);
CREATE INDEX IF NOT EXISTS products_quantity_idx ON public.products (quantity);

-- Dashboard aggregates without loading all rows
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS TABLE (
  total_skus bigint,
  total_units bigint,
  inventory_value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint,
    coalesce(sum(quantity), 0)::bigint,
    coalesce(sum(quantity * cost_price), 0)
  FROM public.products
  WHERE category <> 'devices' AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;
