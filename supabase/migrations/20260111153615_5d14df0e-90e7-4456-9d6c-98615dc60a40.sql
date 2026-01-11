-- Fix 1: Analytics events - remove overly permissive policy that allows reading NULL user_id events
DROP POLICY IF EXISTS "Users can view own events" ON public.analytics_events;
CREATE POLICY "Users can view own events" ON public.analytics_events
  FOR SELECT USING (auth.uid() = user_id);

-- Also fix the INSERT policy to require user_id
DROP POLICY IF EXISTS "Users can insert own events" ON public.analytics_events;
CREATE POLICY "Users can insert own events" ON public.analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix 2: Profiles - add missing DELETE policy for GDPR compliance
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);