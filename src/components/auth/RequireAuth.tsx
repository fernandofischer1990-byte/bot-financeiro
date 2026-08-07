import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/auth/AuthPage';
import { Loader2 } from 'lucide-react';

/** Portão de autenticação: só libera as rotas do app quando há sessão válida. */
export function RequireAuth() {
  const { user, loading } = useAuth();

  // Após o login, honra um redirecionamento `?next=` de mesma origem (página de consentimento OAuth).
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      window.location.replace(next);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <Outlet />;
}
