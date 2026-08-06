DROP TRIGGER IF EXISTS validate_investment_fields_trigger ON public.transactions;

DROP POLICY IF EXISTS "Users can insert own events" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can view own events" ON public.analytics_events;