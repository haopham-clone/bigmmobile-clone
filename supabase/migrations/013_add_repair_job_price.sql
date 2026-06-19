-- Add price column to repair jobs
ALTER TABLE public.repair_jobs
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2);
