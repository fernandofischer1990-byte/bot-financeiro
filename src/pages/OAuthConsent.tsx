import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

// Supabase's auth JS OAuth namespace is currently beta and not fully typed. Wrap
// the three methods we use in a narrow typed shim so the consent flow stays typesafe.
interface AuthorizationClient {
  name?: string;
  client_name?: string;
  logo_uri?: string;
}
interface AuthorizationDetails {
  client?: AuthorizationClient;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
}
interface OAuthApi {
  getAuthorizationDetails(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
}
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Autorização inválida (authorization_id ausente).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "um aplicativo externo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">Conectar ao FinBot</CardTitle>
            <CardDescription className="text-sm mt-1">
              Autorize {clientName} a acessar seus dados financeiros através das ferramentas MCP do FinBot.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm rounded-md border border-destructive/50 bg-destructive/10 text-destructive p-3">
              {error}
            </div>
          )}
          {!details && !error && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando autorização…
            </div>
          )}
          {details && (
            <>
              <p className="text-sm text-muted-foreground">
                Esse aplicativo poderá ler suas transações, adicionar novas, excluir por id e gerar resumos financeiros — sempre em seu nome.
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Recusar
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Autorizar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
