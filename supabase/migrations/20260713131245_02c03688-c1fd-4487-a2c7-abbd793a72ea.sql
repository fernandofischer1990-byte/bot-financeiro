ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS irpf_category TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS average_price NUMERIC,
  ADD COLUMN IF NOT EXISTS custodian_cnpj TEXT;