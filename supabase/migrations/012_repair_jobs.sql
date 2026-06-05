-- Repair job log (customer repairs tracking)

CREATE TABLE IF NOT EXISTS public.repair_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_by_email TEXT,
  customer_name TEXT NOT NULL,
  phone_number TEXT,
  device_model TEXT NOT NULL,
  issue TEXT NOT NULL,
  parts_used TEXT NOT NULL,
  repair_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repair_jobs_repair_date_idx
  ON public.repair_jobs (repair_date DESC);

CREATE INDEX IF NOT EXISTS repair_jobs_customer_name_idx
  ON public.repair_jobs (customer_name);

CREATE INDEX IF NOT EXISTS repair_jobs_phone_number_idx
  ON public.repair_jobs (phone_number);

DROP TRIGGER IF EXISTS repair_jobs_updated_at ON public.repair_jobs;
CREATE TRIGGER repair_jobs_updated_at
  BEFORE UPDATE ON public.repair_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repair_jobs_select_authenticated" ON public.repair_jobs;
CREATE POLICY "repair_jobs_select_authenticated"
  ON public.repair_jobs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "repair_jobs_insert_authenticated" ON public.repair_jobs;
CREATE POLICY "repair_jobs_insert_authenticated"
  ON public.repair_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repair_jobs_update_authenticated" ON public.repair_jobs;
CREATE POLICY "repair_jobs_update_authenticated"
  ON public.repair_jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "repair_jobs_delete_authenticated" ON public.repair_jobs;
CREATE POLICY "repair_jobs_delete_authenticated"
  ON public.repair_jobs FOR DELETE
  TO authenticated
  USING (true);
