
CREATE TABLE public.import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_format text NOT NULL,
  total_records int NOT NULL DEFAULT 0,
  imported_records int NOT NULL DEFAULT 0,
  duplicate_records int NOT NULL DEFAULT 0,
  skipped_records int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own import history"
  ON public.import_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own import history"
  ON public.import_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
