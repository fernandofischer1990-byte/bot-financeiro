-- MFA: quem tem fator TOTP verificado precisa de sessão aal2 para acessar dados financeiros
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO authenticated;

CREATE POLICY "Require MFA when enrolled" ON public.transactions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());
CREATE POLICY "Require MFA when enrolled" ON public.budgets AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());
CREATE POLICY "Require MFA when enrolled" ON public.investments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());