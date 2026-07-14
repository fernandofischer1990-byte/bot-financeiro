import { useState, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INVESTMENT_TYPES } from '@/lib/constants';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { Investment } from '@/types/investment';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Investment | null;
}

export function InvestmentForm({ open, onOpenChange, initial }: Props) {
  const { addInvestment, updateInvestment } = useInvestmentsContext();
  const [name, setName] = useState(initial?.investment_name ?? '');
  const [type, setType] = useState(initial?.investment_type ?? 'outros');
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [initialAmount, setInitialAmount] = useState(String(initial?.initial_amount ?? ''));
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [averagePrice, setAveragePrice] = useState(initial?.averagePrice != null ? String(initial.averagePrice) : '');
  const [custodianCnpj, setCustodianCnpj] = useState(initial?.custodianCnpj ?? '');
  const [showFiscal, setShowFiscal] = useState(Boolean(initial?.averagePrice || initial?.custodianCnpj));
  const [submitting, setSubmitting] = useState(false);

  const parseNum = (v: string) => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !initialAmount) return;
    setSubmitting(true);
    const amount = parseNum(initialAmount);
    const avgNum = averagePrice ? parseNum(averagePrice) : NaN;
    const payload = {
      investment_name: name.trim(),
      investment_type: type,
      institution: institution.trim() || null,
      initial_amount: amount,
      start_date: startDate || null,
      end_date: endDate || null,
      averagePrice: Number.isFinite(avgNum) && avgNum > 0 ? avgNum : undefined,
      custodianCnpj: custodianCnpj.trim() || undefined,
    };
    let ok = false;
    if (initial) ok = await updateInvestment(initial.id, payload);
    else ok = !!(await addInvestment(payload));
    setSubmitting(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar investimento' : 'Novo investimento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="iname">Nome do investimento</Label>
            <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: CDB Banco XP 110% CDI" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst">Instituição</Label>
              <Input id="inst" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: XP, Nubank" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initial">Valor aplicado *</Label>
            <Input id="initial" type="text" inputMode="decimal" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sd">Data início</Label>
              <Input id="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed">Vencimento</Label>
              <Input id="ed" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowFiscal(v => !v)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFiscal ? '▾' : '▸'} Dados fiscais (IRPF) — opcional
            </button>
            {showFiscal && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="avgPrice" className="text-xs">Preço médio (R$)</Label>
                  <Input id="avgPrice" type="text" inputMode="decimal" value={averagePrice} onChange={(e) => setAveragePrice(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="custodianCnpj" className="text-xs">CNPJ do custodiante</Label>
                  <Input id="custodianCnpj" type="text" value={custodianCnpj} onChange={(e) => setCustodianCnpj(e.target.value)} placeholder="00.000.000/0000-00" maxLength={20} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
