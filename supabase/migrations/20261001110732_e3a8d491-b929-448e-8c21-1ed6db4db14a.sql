CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE OR REPLACE FUNCTION private.mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified');
$$;
REVOKE ALL ON FUNCTION private.mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.mfa_satisfied() TO authenticated;

DROP POLICY "Require MFA when enrolled" ON public.transactions;
DROP POLICY "Require MFA when enrolled" ON public.budgets;
DROP POLICY "Require MFA when enrolled" ON public.investments;
DROP FUNCTION public.mfa_satisfied();

CREATE POLICY "Require MFA when enrolled" ON public.transactions AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.mfa_satisfied()) WITH CHECK (private.mfa_satisfied());
CREATE POLICY "Require MFA when enrolled" ON public.budgets AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.mfa_satisfied()) WITH CHECK (private.mfa_satisfied());
CREATE POLICY "Require MFA when enrolled" ON public.investments AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.mfa_satisfied()) WITH CHECK (private.mfa_satisfied());