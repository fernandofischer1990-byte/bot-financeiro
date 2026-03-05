import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/services/analyticsService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    console.log('[Auth] Initializing auth provider');

    // Hard safety net: never keep the app blocked forever
    const timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      console.warn('[Auth] Timeout — releasing UI');
      setLoading(false);
    }, 8000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      window.clearTimeout(timeoutId);
      console.log(`[Auth] State change: ${event}, user: ${session?.user?.id ?? 'none'}`);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' && session?.user?.id) {
        trackEvent(session.user.id, 'user_logged_in', { method: 'email' });
      }
    });

    // THEN check for existing session
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('[Auth] Session recovery error:', error.message);
          if (error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('refresh_token_not_found')) {
            toast({
              title: 'Sessão expirada',
              description: 'Faça login novamente.',
              variant: 'destructive',
            });
            setSession(null);
            setUser(null);
            try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
          }
          return;
        }

        console.log(`[Auth] Session recovered: ${session?.user?.id ?? 'none'}`);
        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('[Auth] Failed to recover session:', err);
      } finally {
        window.clearTimeout(timeoutId);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (error) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    toast({
      title: 'Conta criada!',
      description: 'Você já pode fazer login.',
    });
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: 'Erro ao sair',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
