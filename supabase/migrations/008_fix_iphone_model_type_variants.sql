-- Re-derive iPhone model_type so Pro Max / Pro / Plus / Mini / Air are separate from base number.

WITH iphone_matches AS (
  SELECT
    id,
    regexp_match(
      model,
      '(?i)iPhone\s*(X/XS|XS\s*Max|XS|XR|X|SE|\d{1,2}\s*Pro\s*Max|\d{1,2}\s*Pro|\d{1,2}\s*Plus|\d{1,2}\s*Mini|\d{1,2}\s*Air|\d{1,2}\s*Max|\d{1,2}E|\d{1,2})'
    ) AS match
  FROM public.products
  WHERE lower(brand) = 'apple'
    AND model ~* 'iPhone'
)
UPDATE public.products AS p
SET model_type = 'iPhone ' ||
  CASE
    WHEN upper(regexp_replace(iphone_matches.match[1], '\s+', '', 'g')) = 'XSMAX'
      THEN 'XS MAX'
    ELSE upper(regexp_replace(iphone_matches.match[1], '\s+', ' ', 'g'))
  END
FROM iphone_matches
WHERE p.id = iphone_matches.id
  AND iphone_matches.match IS NOT NULL;
