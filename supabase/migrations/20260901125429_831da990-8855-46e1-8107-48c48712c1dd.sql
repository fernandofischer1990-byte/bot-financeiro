-- C2: auditoria append-only
DROP POLICY IF EXISTS "Users can delete own activity log" ON public.activity_log;
REVOKE UPDATE, DELETE ON public.activity_log FROM authenticated;
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

-- A5: índice para paginação/limite de chat_messages
CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON public.chat_messages (user_id, created_at DESC, id DESC);

-- C1: índices para paginação keyset de transações e investimentos
CREATE INDEX IF NOT EXISTS transactions_user_date_id_idx
  ON public.transactions (user_id, transaction_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS investments_user_amount_id_idx
  ON public.investments (user_id, initial_amount DESC, id DESC);