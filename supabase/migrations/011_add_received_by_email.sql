-- Store who submitted each stock receipt (email at save time)
ALTER TABLE public.stock_receipts
  ADD COLUMN IF NOT EXISTS received_by_email TEXT;
