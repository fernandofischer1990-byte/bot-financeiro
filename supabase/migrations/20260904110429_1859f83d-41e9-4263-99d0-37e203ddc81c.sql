-- 1. Sanitiza valores antes de converter em enums
UPDATE public.transactions SET financial_scope = 'operational'
  WHERE financial_scope IS NULL OR financial_scope NOT IN ('operational','investment');
UPDATE public.transactions SET investment_operation = NULL
  WHERE investment_operation IS NOT NULL
    AND investment_operation NOT IN ('deposit','withdraw','yield','loss');

-- 1b. A checagem em texto é substituída pelo próprio enum
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_financial_scope_check;

-- 2. Enums
CREATE TYPE public.financial_scope_type AS ENUM ('operational','investment');
CREATE TYPE public.investment_operation_type AS ENUM ('deposit','withdraw','yield','loss');

ALTER TABLE public.transactions
  ALTER COLUMN financial_scope DROP DEFAULT;

ALTER TABLE public.transactions
  ALTER COLUMN financial_scope TYPE public.financial_scope_type
    USING financial_scope::public.financial_scope_type,
  ALTER COLUMN investment_operation TYPE public.investment_operation_type
    USING investment_operation::public.investment_operation_type;

ALTER TABLE public.transactions
  ALTER COLUMN financial_scope SET DEFAULT 'operational'::public.financial_scope_type;

-- 2b. Trigger de validação com casts explícitos para os novos tipos
CREATE OR REPLACE FUNCTION public.validate_investment_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.type = 'investment' THEN
    NEW.financial_scope := 'investment'::public.financial_scope_type;
    IF NEW.investment_operation IS NULL THEN
      RAISE EXCEPTION 'investment_operation deve ser deposit, withdraw, yield ou loss';
    END IF;
    IF NEW.investment_type IS NULL OR length(trim(NEW.investment_type)) = 0 THEN
      RAISE EXCEPTION 'investment_type é obrigatório para transações de investimento';
    END IF;
  ELSE
    NEW.financial_scope := 'operational'::public.financial_scope_type;
    NEW.investment_operation := NULL;
    NEW.investment_type := NULL;
    NEW.institution := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

-- 3. Índices padronizados
DROP INDEX IF EXISTS public.idx_transactions_user_id;
DROP INDEX IF EXISTS public.idx_investments_user_id;
CREATE INDEX IF NOT EXISTS transactions_user_scope_date_idx
  ON public.transactions (user_id, financial_scope, transaction_date);
CREATE INDEX IF NOT EXISTS transactions_user_scope_type_idx
  ON public.transactions (user_id, financial_scope, type);
CREATE INDEX IF NOT EXISTS investments_user_type_idx
  ON public.investments (user_id, investment_type);

-- 4. Métricas agregadas no Postgres (RLS aplicada: SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.get_financial_metrics(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
WITH tx AS (
  SELECT t.* FROM public.transactions t
  WHERE t.user_id = auth.uid()
    AND (p_start IS NULL OR t.transaction_date >= p_start)
    AND (p_end IS NULL OR t.transaction_date <= p_end)
),
op AS (
  SELECT * FROM tx WHERE financial_scope = 'operational'::public.financial_scope_type
),
inv_tx AS (
  SELECT * FROM tx WHERE financial_scope = 'investment'::public.financial_scope_type
),
pos AS (SELECT * FROM public.investments WHERE user_id = auth.uid()),
totals AS (
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS total_income,
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS total_expenses
  FROM op
),
cats AS (
  SELECT jsonb_object_agg(category, total) AS by_category
  FROM (SELECT category, SUM(amount) AS total FROM op GROUP BY category) c
),
months AS (
  SELECT to_char(transaction_date, 'YYYY-MM') AS month_key,
         COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expenses
  FROM op GROUP BY 1
),
inv_months AS (
  SELECT to_char(transaction_date, 'YYYY-MM') AS month_key,
         COALESCE(SUM(CASE
           WHEN investment_operation IN ('deposit'::public.investment_operation_type,
                                         'yield'::public.investment_operation_type) THEN amount
           WHEN investment_operation IN ('withdraw'::public.investment_operation_type,
                                         'loss'::public.investment_operation_type) THEN -amount
           ELSE 0 END), 0) AS invested
  FROM inv_tx GROUP BY 1
),
pos_months AS (
  SELECT to_char(COALESCE(start_date, created_at::date), 'YYYY-MM') AS month_key,
         SUM(initial_amount) AS invested
  FROM pos GROUP BY 1
),
flows AS (
  SELECT month_key,
         SUM(income) AS income,
         SUM(expenses) AS expenses,
         SUM(available) AS available,
         SUM(invested) AS invested
  FROM (
    SELECT month_key, income, expenses, income - expenses AS available, 0::numeric AS invested FROM months
    UNION ALL SELECT month_key, 0, 0, 0, invested FROM inv_months
    UNION ALL SELECT month_key, 0, 0, 0, invested FROM pos_months
  ) x
  GROUP BY month_key
),
grp AS (
  SELECT lower(trim(COALESCE(investment_type, 'outros'))) AS itype,
         lower(trim(COALESCE(institution, ''))) AS inst,
         SUM(CASE WHEN investment_operation = 'deposit'::public.investment_operation_type THEN amount
                  WHEN investment_operation = 'withdraw'::public.investment_operation_type THEN -amount
                  ELSE 0 END) AS net_flow,
         SUM(CASE WHEN investment_operation = 'yield'::public.investment_operation_type THEN amount
                  ELSE 0 END) AS yields,
         SUM(CASE WHEN investment_operation = 'loss'::public.investment_operation_type THEN amount
                  ELSE 0 END) AS losses,
         0::numeric AS positions
  FROM inv_tx GROUP BY 1, 2
  UNION ALL
  SELECT lower(trim(COALESCE(investment_type, 'outros'))),
         lower(trim(COALESCE(institution, ''))),
         0, 0, 0, SUM(initial_amount)
  FROM pos GROUP BY 1, 2
),
grp_agg AS (
  SELECT itype,
         SUM(net_flow) AS net_flow,
         SUM(yields) AS yields,
         SUM(losses) AS losses,
         SUM(positions) AS positions
  FROM grp GROUP BY itype, inst
),
grp_val AS (
  SELECT itype, GREATEST(positions, net_flow) + yields - losses AS value FROM grp_agg
),
by_type AS (
  SELECT jsonb_object_agg(itype, v) AS by_type, COALESCE(SUM(v), 0) AS invested_balance
  FROM (SELECT itype, SUM(value) AS v FROM grp_val GROUP BY itype) z
),
inv_sum AS (
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE investment_operation = 'deposit'::public.investment_operation_type), 0) AS deposits,
    COALESCE(SUM(amount) FILTER (WHERE investment_operation = 'withdraw'::public.investment_operation_type), 0) AS withdraws,
    COALESCE(SUM(amount) FILTER (WHERE investment_operation = 'yield'::public.investment_operation_type), 0) AS yields,
    COALESCE(SUM(amount) FILTER (WHERE investment_operation = 'loss'::public.investment_operation_type), 0) AS losses
  FROM inv_tx
)
SELECT jsonb_build_object(
  'total_income', totals.total_income,
  'total_expenses', totals.total_expenses,
  'available_balance', totals.total_income - totals.total_expenses,
  'invested_balance', COALESCE(by_type.invested_balance, 0),
  'net_worth', totals.total_income - totals.total_expenses + COALESCE(by_type.invested_balance, 0),
  'by_category', COALESCE(cats.by_category, '{}'::jsonb),
  'by_type', COALESCE(by_type.by_type, '{}'::jsonb),
  'investment_summary', jsonb_build_object(
    'deposits', inv_sum.deposits,
    'withdraws', inv_sum.withdraws,
    'yields', inv_sum.yields,
    'losses', inv_sum.losses
  ),
  'months', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'month_key', month_key,
      'income', income,
      'expenses', expenses,
      'available', available,
      'invested', invested
    ) ORDER BY month_key) FROM flows
  ), '[]'::jsonb)
)
FROM totals, cats, by_type, inv_sum;
$fn$;

REVOKE ALL ON FUNCTION public.get_financial_metrics(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_metrics(date, date) TO authenticated;