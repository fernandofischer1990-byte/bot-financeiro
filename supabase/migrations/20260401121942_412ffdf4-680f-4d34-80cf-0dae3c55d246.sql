CREATE TABLE public.mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  mapping jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own templates" ON public.mapping_templates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);