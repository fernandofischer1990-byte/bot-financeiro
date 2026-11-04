import { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PasswordRequester } from '@/lib/pdfDecrypt';

type Pending = { wrong: boolean; resolve: (v: string | null) => void };

let open: ((p: Pending) => void) | null = null;

/** Abre o diálogo de senha e devolve a senha digitada (ou null se cancelar). */
export const requestPdfPassword: PasswordRequester = (wrong) =>
  new Promise((resolve) => {
    if (!open) return resolve(null);
    open({ wrong, resolve });
  });

export function PdfPasswordDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    open = (p) => { setValue(''); setPending(p); };
    return () => { open = null; };
  }, []);

  const finish = (v: string | null) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => { if (!o) finish(null); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); if (value) finish(value); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Extrato protegido por senha</DialogTitle>
            <DialogDescription>
              Digite a senha do PDF. Nos bancos ela costuma ser parte do CPF ou a data de nascimento. A senha é usada só no seu navegador e não é salva.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="pdf-password">Senha do PDF</Label>
            <div className="relative">
              <Input id="pdf-password" type={show ? 'text' : 'password'} autoFocus autoComplete="off"
                value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={pending?.wrong} className="pr-10" />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pending?.wrong && <p className="text-sm text-destructive">Senha incorreta. Tente novamente.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(null)}>Cancelar</Button>
            <Button type="submit" disabled={!value}>Desbloquear e processar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
