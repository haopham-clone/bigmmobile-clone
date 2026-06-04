-- One model_type per shared iPhone family (6P/7P/8P, 13/14, …), not per case style name.

WITH fixes AS (
  SELECT
    id,
    'iPhone ' || upper(
      substring(model from '(?i)iPhone\s*((?:\d{1,2}[A-Z]?)(?:/\d{1,2}[A-Z]?)+)')
    ) AS fixed_type
  FROM public.products
  WHERE lower(brand) = 'apple'
    AND model ~* 'iPhone\s*\d{1,2}[A-Z]?/\d{1,2}'
)
UPDATE public.products AS p
SET model_type = fixes.fixed_type
FROM fixes
WHERE p.id = fixes.id
  AND fixes.fixed_type IS NOT NULL
  AND coalesce(p.model_type, '') IS DISTINCT FROM fixes.fixed_type;
