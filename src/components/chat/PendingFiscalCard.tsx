import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import type { PendingFiscal } from './chatTypes';

// ── Fiscal fields confirmation card ─────────────────────────────────
export function PendingFiscalCard({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingFiscal;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">
          Confirmar dados fiscais — {pending.kind === 'transaction' ? 'Transação' : 'Investimento'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground break-words">{pending.label}</p>

      <ul className="space-y-2">
        {pending.fields.map((f) => (
          <li key={f.key} className="text-xs">
            <span className="font-medium">{f.label}</span>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-muted-foreground line-through break-all">
                {f.current || 'vazio'}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-primary font-medium break-all">{f.next}</span>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground">
        Nada é salvo até você confirmar.
      </p>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button size="sm" onClick={onConfirm} className="flex-1">Confirmar</Button>
      </div>
    </div>
  );
}
