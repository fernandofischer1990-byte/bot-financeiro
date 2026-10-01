import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/auth/AuthPage';
import { MfaChallenge } from '@/components/auth/MfaChallenge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

type MfaState = 'checking' | 'required' | 'ok';

/** Portão de autenticação: exige sessão válida e, se o usuário ativou MFA, o segundo fator. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const [mfa, setMfa] = useState<MfaState>('checking');

  useEffect(() => {
    if (!user) { setMfa('checking'); return; }
    let cancelled = false;
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (cancelled) return;
      setMfa(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'required' : 'ok');
    });
    return () => { cancelled = true; };
  }, [user]);

  // Após o login, honra um redirecionamento `?next=` de mesma origem (página de consentimento OAuth).
  useEffect(() => {
    if (!user || mfa !== 'ok') return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      window.location.replace(next);
    }
  }, [user, mfa]);

  if (loading || (user && mfa === 'checking')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (mfa === 'required') return <MfaChallenge onVerified={() => window.location.reload()} />;
  return <Outlet />;
}
