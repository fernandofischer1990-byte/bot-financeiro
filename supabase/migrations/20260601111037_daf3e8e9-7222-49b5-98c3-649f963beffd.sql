
-- 1. Add financial_scope column to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS financial_scope text NOT NULL DEFAULT 'operational'
    CHECK (financial_scope IN ('operational','investment'));

-- Backfill
UPDATE public.transactions SET financial_scope = 'investment' WHERE type = 'investment';

-- Update validation trigger
CREATE OR REPLACE FUNCTION public.validate_investment_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'investment' THEN
    NEW.financial_scope := 'investment';
    IF NEW.investment_operation IS NULL OR NEW.investment_operation NOT IN ('deposit','withdraw','yield','loss') THEN
      RAISE EXCEPTION 'investment_operation deve ser deposit, withdraw, yield ou loss';
    END IF;
    IF NEW.investment_type IS NULL OR length(trim(NEW.investment_type)) = 0 THEN
      RAISE EXCEPTION 'investment_type é obrigatório para transações de investimento';
    END IF;
  ELSE
    NEW.financial_scope := 'operational';
    NEW.investment_operation := NULL;
    NEW.investment_type := NULL;
    NEW.institution := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_investment_fields_trigger ON public.transactions;
CREATE TRIGGER validate_investment_fields_trigger
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_investment_fields();

-- 2. Create investments table
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investment_name text NOT NULL,
  investment_type text NOT NULL DEFAULT 'outros',
  institution text,
  initial_amount numeric(18,2) NOT NULL DEFAULT 0,
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  term_days integer,
  term_months integer,
  term_years integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_from text NOT NULL DEFAULT 'manual',
  source_file_name text,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own investments"
  ON public.investments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments"
  ON public.investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments"
  ON public.investments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments"
  ON public.investments FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_investments_updated_at
BEFORE UPDATE ON public.investments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_investments_user_id ON public.investments(user_id);
CREATE INDEX idx_investments_type ON public.investments(investment_type);
