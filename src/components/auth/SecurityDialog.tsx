import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporting';

interface Enrollment { factorId: string; qr: string; secret: string }

/** Ativação/desativação da verificação em duas etapas (TOTP). */
export function SecurityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setActiveFactorId(data?.totp.find((f) => f.status === 'verified')?.id ?? null);
  }, []);

  useEffect(() => {
    if (open) void refresh();
    else { setEnrollment(null); setCode(''); }
  }, [open, refresh]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      // Remove tentativas anteriores não concluídas
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `FinBot ${Date.now()}` });
      if (error) throw error;
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      const { errorId } = reportError(err, 'mfa.enroll');
      toast({ title: 'Não foi possível iniciar a ativação', description: `Código do erro: ${errorId}`, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const confirmEnroll = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
      if (error) throw error;
      toast({ title: 'Verificação em duas etapas ativada' });
      setEnrollment(null); setCode('');
      await refresh();
    } catch (err) {
      reportError(err, 'mfa.verify');
      toast({ title: 'Código inválido', description: 'Confira o código no app autenticador.', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const disable = async () => {
    if (!activeFactorId) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: activeFactorId });
      if (error) throw error;
      await supabase.auth.refreshSession();
      toast({ title: 'Verificação em duas etapas desativada' });
      await refresh();
    } catch (err) {
      const { errorId } = reportError(err, 'mfa.unenroll');
      toast({ title: 'Não foi possível desativar', description: `Código do erro: ${errorId}`, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Segurança da conta</DialogTitle>
          <DialogDescription>
            Com a verificação em duas etapas, suas transações, orçamentos e investimentos só abrem após o código do app autenticador.
          </DialogDescription>
        </DialogHeader>

        {enrollment ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Escaneie o QR code no Google Authenticator, Authy ou similar.</p>
            <img src={enrollment.qr} alt="QR code para o app autenticador" className="mx-auto h-44 w-44 rounded-md bg-card p-2" />
            <p className="text-xs text-center text-muted-foreground break-all">Chave manual: <span className="font-mono">{enrollment.secret}</span></p>
            <div className="space-y-2">
              <Label htmlFor="enroll-code">Código de 6 dígitos</Label>
              <Input id="enroll-code" inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center tracking-widest" />
            </div>
            <Button className="w-full" onClick={confirmEnroll} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ativar
            </Button>
          </div>
        ) : activeFactorId ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-accent">Verificação em duas etapas está ativa.</p>
            <Button variant="outline" className="w-full" onClick={disable} disabled={busy}>Desativar</Button>
          </div>
        ) : (
          <Button className="w-full" onClick={startEnroll} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ativar verificação em duas etapas
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
