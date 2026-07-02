
-- Revoke public execution on SECURITY DEFINER function used only as trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Also lock down other trigger-only functions
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_investment_fields() FROM PUBLIC, anon, authenticated;

-- Restrict analytics_events policies to authenticated role only
DROP POLICY IF EXISTS "Users can insert their own analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can view their own analytics events" ON public.analytics_events;

CREATE POLICY "Users can insert their own analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Remove transactions from realtime publication (app does not use realtime subscriptions)
ALTER PUBLICATION supabase_realtime DROP TABLE public.transactions;
