-- Merge glued iPhone model_type labels (13PRO MAX → 13 PRO MAX, 13PROMAX → 13 PRO MAX).

UPDATE public.products
SET model_type = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(upper(model_type), '(\d{2})PROMAX', '\1 PRO MAX', 'gi'),
        '(\d{2}[A-Z])PROMAX',
        '\1 PRO MAX',
        'gi'
      ),
      '(\d{2})PRO(\s+MAX)', '\1 PRO\2', 'gi'
    ),
    '(\d{2})PRO([^M\s/])', '\1 PRO \2', 'gi'
  )
)
WHERE model_type ~* '^iPhone\s*\d{1,2}';

-- Second pass: fix 13PRO MAX → 13 PRO MAX (PRO glued to digits only)
UPDATE public.products
SET model_type = regexp_replace(model_type, '(\d{2})PRO ', '\1 PRO ', 'gi')
WHERE model_type ~* '^iPhone\s*\d{2}PRO\s';

UPDATE public.products
SET model_type = regexp_replace(model_type, '(\d{2})PRO$', '\1 PRO', 'gi')
WHERE model_type ~* '^iPhone\s*\d{2}PRO$';
