CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_id ON public.transactions (user_id, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_description_trgm ON public.transactions USING gin (description extensions.gin_trgm_ops);