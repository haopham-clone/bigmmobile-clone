ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS model_type TEXT;

WITH iphone_matches AS (
  SELECT id, regexp_match(model, '(?i)iPhone\s*(X/XS|XS\s*Max|XS|XR|X|SE|[0-9]{1,2}E?)') AS match
  FROM public.products
  WHERE model_type IS NULL
    AND lower(brand) = 'apple'
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

UPDATE public.products
SET model_type = 'iPhone XS MAX'
WHERE model_type = 'iPhone XSMAX';

WITH ipad_matches AS (
  SELECT id, regexp_match(model, '(?i)iPad\s*(Air|Pro|Mini)?\s*([0-9]{1,2}(\.[0-9])?|[A-Z][0-9]{1,2})?') AS match
  FROM public.products
  WHERE model_type IS NULL
    AND lower(brand) = 'apple'
    AND model ~* 'iPad'
)
UPDATE public.products AS p
SET model_type = trim(
  regexp_replace(
    'iPad ' || coalesce(ipad_matches.match[1], '') || ' ' || coalesce(ipad_matches.match[2], ''),
    '\s+',
    ' ',
    'g'
  )
)
FROM ipad_matches
WHERE p.id = ipad_matches.id
  AND ipad_matches.match IS NOT NULL;

WITH samsung_matches AS (
  SELECT
    id,
    regexp_match(
      coalesce(nullif(model_type, ''), model),
      '(?i)(^|[^[:alnum:]])(Galaxy\s+)?((S|A|M)\s*[0-9]{1,3}|Note\s*[0-9]{1,3}|Z\s+(Fold|Flip)\s*[0-9]{1,2})'
    ) AS match
  FROM public.products
  WHERE lower(brand) = 'samsung'
)
UPDATE public.products AS p
SET model_type = 'Galaxy ' || upper(regexp_replace(samsung_matches.match[3], '\s+', ' ', 'g'))
FROM samsung_matches
WHERE p.id = samsung_matches.id
  AND samsung_matches.match IS NOT NULL
  AND (
    p.model_type IS NULL
    OR p.model_type = ''
    OR p.model_type !~* '^Galaxy\s+(S|A|M|Note|Z)'
  );

WITH pixel_matches AS (
  SELECT
    id,
    regexp_match(model, '(?i)Pixel\s*([0-9]{1,2}[A-Z]?)') AS match
  FROM public.products
  WHERE lower(brand) = 'google'
)
UPDATE public.products AS p
SET model_type = 'Pixel ' || upper(pixel_matches.match[1])
FROM pixel_matches
WHERE p.id = pixel_matches.id
  AND pixel_matches.match IS NOT NULL
  AND (p.model_type IS NULL OR p.model_type = '');

UPDATE public.products
SET model_type = 'Other Phone Cases'
WHERE category = 'phone-cases'
  AND (
    lower(brand) IN ('other', 'phone', 'universal')
    OR coalesce(model_type, '') ~* '^(Phone Belt|Phone Cases)$'
    OR model ~* '^(Phone\s*(Belt|Case|Cases)?|Crossbody|Lanyards?|Magsafe\s+(Back Card Holder|Rings))'
  );

CREATE INDEX IF NOT EXISTS idx_products_category_brand_model_type
ON public.products (category, brand, model_type)
WHERE is_active = true;
