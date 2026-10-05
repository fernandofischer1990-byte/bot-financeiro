import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVESTMENT_TYPES, INVESTMENT_OPERATIONS } from '@/lib/constants';
import { getSpendingAlert } from '@/lib/financialAnalytics';
import { parseDateOnly, getLocalISODate } from '@/lib/dateUtils';
import type { AddTxPayload, PendingAdd } from './chatTypes';

// ── Editable confirmation card ──────────────────────────────────────
export interface PendingAddCardProps {
  pending: PendingAdd;
  monthlyIncome: number;
  onChange: (patch: Partial<AddTxPayload>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PendingAddCard({ pending, monthlyIncome, onChange, onConfirm, onCancel }: PendingAddCardProps) {
  const { edited, original, isDuplicate } = pending;
  const [isDateOpen, setIsDateOpen] = useState(false);
  const isInvestment = edited.type === 'investment';
  const categories = edited.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const alert = edited.type === 'expense' && edited.amount > 0 ? getSpendingAlert(edited.amount, monthlyIncome) : null;
  const categoryChanged = !isInvestment && edited.category !== original.category && edited.description;

  const dateObj = edited.date ? parseDateOnly(edited.date) : new Date();

  const title = isInvestment ? 'Confirmar Investimento' : edited.type === 'income' ? 'Confirmar Receita' : 'Confirmar Despesa';

  return (
    <div className="flex justify-start">
      <div className="bg-muted p-4 rounded-lg w-full max-w-[90%] border border-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{title}</h4>
          <Select value={edited.type} onValueChange={(v) => onChange({ type: v as 'income' | 'expense' | 'investment' })}>
            <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income" className="text-xs">Receita</SelectItem>
              <SelectItem value="expense" className="text-xs">Despesa</SelectItem>
              <SelectItem value="investment" className="text-xs">Investimento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {alert && (
          <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-3 py-1.5 font-medium">
            {alert}
          </div>
        )}
        {isDuplicate && (
          <p className="text-xs text-destructive font-medium">Esta transação parece duplicada. Confirma mesmo assim?</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Valor</label>
            <Input
              type="text"
              inputMode="decimal"
              value={String(edited.amount).replace('.', ',')}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.');
                const n = parseFloat(raw);
                onChange({ amount: isNaN(n) ? 0 : Math.abs(n) });
              }}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Data</label>
            <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-start font-normal">
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  {format(dateObj, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateObj}
                  onSelect={(d) => {
                    if (d) {
                      onChange({ date: getLocalISODate(d) });
                      setIsDateOpen(false);
                    }
                  }}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isInvestment ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Operação</label>
              <Select
                value={edited.investment_operation || 'deposit'}
                onValueChange={(v) => onChange({ investment_operation: v as 'deposit' | 'withdraw' | 'yield' | 'loss' })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_OPERATIONS.map(op => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">{op.icon} {op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Tipo</label>
              <Select
                value={edited.investment_type || 'outros'}
                onValueChange={(v) => onChange({ investment_type: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground">Instituição (opcional)</label>
              <Input
                value={edited.institution || ''}
                onChange={(e) => onChange({ institution: e.target.value })}
                placeholder="Ex: Nubank, XP, BTG..."
                className="h-8 text-sm"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[11px] text-muted-foreground">Categoria</label>
            <Select value={edited.category} onValueChange={(v) => onChange({ category: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryChanged && (
              <p className="text-[11px] text-primary flex items-center gap-1 pt-1">
                <Sparkles className="h-3 w-3" />
                Vou aprender essa categoria para "{edited.description}"
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] text-muted-foreground">Descrição</label>
          <Textarea
            value={edited.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className="text-sm min-h-[40px]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onConfirm} className="flex-1">Confirmar</Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
