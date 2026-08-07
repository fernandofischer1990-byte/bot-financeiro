import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataState } from '@/components/common/DataState';
import { useBudgets, monthKeyOf } from '@/hooks/useBudgets';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { computeBudgetAwareness } from '@/lib/financialAnalytics';
import { EXPENSE_CATEGORIES, formatCurrency, getCategoryLabel } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Target, Trash2 } from 'lucide-react';

export function BudgetsPanel() {
  const monthKey = monthKeyOf();
  const { transactions } = useTransactionsContext();
  const { budgets, loading, error, save, remove, refetch } = useBudgets(monthKey);
  const { toast } = useToast();

  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]?.value ?? '');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const awareness = useMemo(
    () => computeBudgetAwareness(transactions, budgets, monthKey),
    [transactions, budgets, monthKey]
  );

  const handleSave = async () => {
    const value = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!category || !Number.isFinite(value) || value <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const ok = await save({ category, monthKey, amount: value });
    setSaving(false);
    if (ok) {
      setAmount('');
      toast({ title: 'Orçamento salvo', description: `${getCategoryLabel(category)} definido em ${formatCurrency(value)}.` });
    } else {
      toast({ title: 'Erro ao salvar orçamento', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Orçamentos do mês
        </CardTitle>
        <CardDescription>{awareness.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-56" aria-label="Categoria do orçamento">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Limite mensal (ex.: 1200,00)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Limite mensal"
          />
          <Button onClick={handleSave} disabled={saving}>
            Salvar
          </Button>
        </div>

        <DataState
          loading={loading}
          error={error}
          isEmpty={budgets.length === 0}
          emptyTitle="Nenhum orçamento definido"
          emptyDescription="Defina um limite por categoria para acompanhar seus gastos do mês."
          onRetry={refetch}
        >
          <ul className="space-y-3">
            {awareness.statuses.map((s) => {
              const budget = budgets.find((b) => b.category === s.category);
              return (
                <li key={s.category} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{getCategoryLabel(s.category)}</span>
                    <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                      {formatCurrency(s.spent)} / {formatCurrency(s.budget)}
                      {budget && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Remover orçamento de ${getCategoryLabel(s.category)}`}
                          onClick={() => remove(budget.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, s.pct)}
                    className={cn(
                      s.level === 'exceeded' && '[&>div]:bg-destructive',
                      s.level === 'warning' && '[&>div]:bg-accent'
                    )}
                  />
                  <p
                    className={cn(
                      'text-xs',
                      s.level === 'exceeded' ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {s.level === 'exceeded'
                      ? `Excedido em ${formatCurrency(Math.abs(s.remaining))}`
                      : `Restam ${formatCurrency(s.remaining)} (${s.pct.toFixed(0)}% usado)`}
                  </p>
                </li>
              );
            })}
          </ul>
        </DataState>
      </CardContent>
    </Card>
  );
}
