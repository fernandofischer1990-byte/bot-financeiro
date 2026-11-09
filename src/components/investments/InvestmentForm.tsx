import { useState, useMemo, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INVESTMENT_TYPES } from '@/lib/constants';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { Investment } from '@/types/investment';
import { cn } from '@/lib/utils';
import {
  maskCurrencyInput, formatCurrencyInput, parseCurrencyInput,
  maskCnpj, isCnpjComplete, buildInstitutionSuggestions,
} from '@/lib/inputMasks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Investment | null;
}

function MoneyInput({ id, value, onChange, invalid, describedBy }: {
  id: string; value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id} type="text" inputMode="decimal" placeholder="0,00"
        value={value} onChange={(e) => onChange(maskCurrencyInput(e.target.value))}
        className={cn('pl-10 text-right tabular-nums', invalid && 'border-destructive focus-visible:ring-destructive')}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
      />
    </div>
  );
}

export function InvestmentForm({ open, onOpenChange, initial }: Props) {
  const { addInvestment, updateInvestment, investments } = useInvestmentsContext();
  const [name, setName] = useState(initial?.investment_name ?? '');
  const [type, setType] = useState(initial?.investment_type ?? 'outros');
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [initialAmount, setInitialAmount] = useState(formatCurrencyInput(initial?.initial_amount != null ? Number(initial.initial_amount) : null));
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [averagePrice, setAveragePrice] = useState(formatCurrencyInput(initial?.averagePrice));
  const [custodianCnpj, setCustodianCnpj] = useState(maskCnpj(initial?.custodianCnpj ?? ''));
  const [showFiscal, setShowFiscal] = useState(Boolean(initial?.averagePrice || initial?.custodianCnpj));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(
    () => buildInstitutionSuggestions(investments.map(i => i.institution)),
    [investments],
  );
  const filtered = useMemo(() => {
    const q = institution.trim().toLowerCase();
    return suggestions.filter(s => !q || (s.toLowerCase().includes(q) && s.toLowerCase() !== q)).slice(0, 8);
  }, [suggestions, institution]);

  const nameError = !name.trim() ? 'Informe o nome do investimento.' : null;
  const amountError = parseCurrencyInput(initialAmount) <= 0 ? 'Informe um valor maior que zero.' : null;
  const cnpjError = !isCnpjComplete(custodianCnpj) ? 'CNPJ incompleto: são 14 dígitos.' : null;
  const dateError = startDate && endDate && endDate < startDate ? 'O vencimento não pode ser antes do início.' : null;
  const hasErrors = Boolean(nameError || amountError || cnpjError || dateError);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) {
      if (cnpjError) setShowFiscal(true);
      return;
    }
    setSubmitting(true);
    const avgNum = parseCurrencyInput(averagePrice);
    const payload = {
      investment_name: name.trim(),
      investment_type: type,
      institution: institution.trim() || null,
      initial_amount: parseCurrencyInput(initialAmount),
      start_date: startDate || null,
      end_date: endDate || null,
      averagePrice: avgNum > 0 ? avgNum : undefined,
      custodianCnpj: custodianCnpj.trim() || undefined,
    };
    let ok = false;
    if (initial) ok = await updateInvestment(initial.id, payload);
    else ok = !!(await addInvestment(payload));
    setSubmitting(false);
    if (ok) onOpenChange(false);
  };

  const err = (msg: string | null, id: string) =>
    touched && msg ? <p id={id} role="alert" className="text-xs text-destructive">{msg}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar investimento' : 'Novo investimento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="iname">Nome do investimento *</Label>
            <Input
              id="iname" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: CDB Banco XP 110% CDI"
              className={cn(touched && nameError && 'border-destructive focus-visible:ring-destructive')}
              aria-invalid={(touched && !!nameError) || undefined} aria-describedby="iname-err"
            />
            {err(nameError, 'iname-err')}
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
            <div className="relative space-y-1.5">
              <Label htmlFor="inst">Instituição</Label>
              <Input
                id="inst" value={institution} autoComplete="off"
                onChange={(e) => { setInstitution(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                placeholder="Ex: XP, Nubank"
                role="combobox" aria-expanded={showSuggestions && filtered.length > 0} aria-controls="inst-list"
              />
              {showSuggestions && filtered.length > 0 && (
                <ul id="inst-list" role="listbox" className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md">
                  {filtered.map(s => (
                    <li key={s} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setInstitution(s); setShowSuggestions(false); }}
                        className="w-full rounded-sm px-2 py-1.5 text-left text-popover-foreground hover:bg-accent/15"
                      >{s}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initial">Valor aplicado *</Label>
            <MoneyInput id="initial" value={initialAmount} onChange={setInitialAmount} invalid={touched && !!amountError} describedBy="initial-err" />
            {err(amountError, 'initial-err')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sd">Data início</Label>
              <Input id="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed">Vencimento</Label>
              <Input id="ed" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className={cn(touched && dateError && 'border-destructive')} aria-describedby="ed-err" />
            </div>
          </div>
          {err(dateError, 'ed-err')}

          <div className="border-t pt-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowFiscal(v => !v)}
              aria-expanded={showFiscal}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFiscal ? '▾' : '▸'} Dados fiscais (IRPF) — opcional
            </button>
            {showFiscal && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="avgPrice" className="text-xs">Preço médio</Label>
                  <MoneyInput id="avgPrice" value={averagePrice} onChange={setAveragePrice} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="custodianCnpj" className="text-xs">CNPJ do custodiante</Label>
                  <Input
                    id="custodianCnpj" type="text" inputMode="numeric" value={custodianCnpj}
                    onChange={(e) => setCustodianCnpj(maskCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00" maxLength={18}
                    className={cn('tabular-nums', touched && cnpjError && 'border-destructive focus-visible:ring-destructive')}
                    aria-invalid={(touched && !!cnpjError) || undefined} aria-describedby="cnpj-err"
                  />
                  {err(cnpjError, 'cnpj-err')}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting || (touched && hasErrors)}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
