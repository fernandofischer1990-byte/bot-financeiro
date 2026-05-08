-- Add 'investment' to transaction_type enum
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'investment';

-- Add investment-specific columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS investment_operation text,
  ADD COLUMN IF NOT EXISTS investment_type text,
  ADD COLUMN IF NOT EXISTS institution text;

-- Validation trigger for investment fields
CREATE OR REPLACE FUNCTION public.validate_investment_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'investment' THEN
    IF NEW.investment_operation IS NULL OR NEW.investment_operation NOT IN ('deposit','withdraw','yield','loss') THEN
      RAISE EXCEPTION 'investment_operation deve ser deposit, withdraw, yield ou loss';
    END IF;
    IF NEW.investment_type IS NULL OR length(trim(NEW.investment_type)) = 0 THEN
      RAISE EXCEPTION 'investment_type é obrigatório para transações de investimento';
    END IF;
  ELSE
    IF NEW.investment_operation IS NOT NULL OR NEW.investment_type IS NOT NULL OR NEW.institution IS NOT NULL THEN
      NEW.investment_operation := NULL;
      NEW.investment_type := NULL;
      NEW.institution := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_investment_fields ON public.transactions;
CREATE TRIGGER trg_validate_investment_fields
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_investment_fields();