import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, TrendingUp, TrendingDown, PiggyBank, Target } from 'lucide-react';
import { Transaction, TransactionMetrics } from '@/contexts/TransactionsContext';
import { Investment } from '@/types/investment';
import { formatCurrency } from '@/lib/constants';
import { useMemo } from 'react';

interface InsightsPanelProps {
  transactions: Transaction[];
  metrics: TransactionMetrics;
  investments: Investment[];
}

interface Insight {
  icon: typeof Sparkles;
  tone: 'positive' | 'warning' | 'neutral';
  title: string;
  description: string;
}

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getPrevMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function InsightsPanel({ transactions, metrics, investments }: InsightsPanelProps) {
  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const curr = getCurrentMonthKey();
    const prev = getPrevMonthKey();
    let currExp = 0, prevExp = 0, currInc = 0;
    for (const t of transactions) {
      if ((t.financial_scope ?? 'operational') !== 'operational') continue;
      const mk = t.transaction_date.substring(0, 7);
      if (mk === curr) {
        if (t.type === 'expense') currExp += Number(t.amount);
        if (t.type === 'income') currInc += Number(t.amount);
      } else if (mk === prev) {
        if (t.type === 'expense') prevExp += Number(t.amount);
      }
    }
    if (prevExp > 0) {
      const variation = ((currExp - prevExp) / prevExp) * 100;
      if (Math.abs(variation) >= 5) {
        out.push({
          icon: variation > 0 ? TrendingUp : TrendingDown,
          tone: variation > 0 ? 'warning' : 'positive',
          title: variation > 0 ? 'Despesas em alta' : 'Despesas em queda',
          description: `Seus gastos ${variation > 0 ? 'aumentaram' : 'reduziram'} ${Math.abs(variation).toFixed(1)}% em relação ao mês passado.`,
        });
      }
    }
    if (currInc > 0) {
      const savingsRate = ((currInc - currExp) / currInc) * 100;
      out.push({
        icon: PiggyBank,
        tone: savingsRate >= 20 ? 'positive' : savingsRate >= 0 ? 'neutral' : 'warning',
        title: `Taxa de poupança: ${savingsRate.toFixed(1)}%`,
        description:
          savingsRate >= 20
            ? 'Excelente! Você está acima da meta saudável de 20%.'
            : savingsRate >= 0
              ? 'Você está economizando — tente atingir 20% para acelerar seu patrimônio.'
              : 'Atenção: você gastou mais do que recebeu este mês.',
      });
    }
    if (metrics.netWorth > 0 && metrics.investedBalance > 0) {
      const pct = (metrics.investedBalance / metrics.netWorth) * 100;
      out.push({
        icon: Target,
        tone: 'neutral',
        title: `${pct.toFixed(0)}% do patrimônio investido`,
        description: `Você tem ${formatCurrency(metrics.investedBalance)} alocados em ${investments.length} ativo${investments.length === 1 ? '' : 's'}.`,
      });
    }
    return out.slice(0, 3);
  }, [transactions, metrics, investments]);

  if (insights.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg gradient-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="font-semibold">Insights financeiros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const Icon = ins.icon;
            const toneClass =
              ins.tone === 'positive'
                ? 'text-success bg-success/10 border-success/20'
                : ins.tone === 'warning'
                  ? 'text-warning bg-warning/10 border-warning/30'
                  : 'text-primary bg-primary/10 border-primary/20';
            return (
              <div
                key={i}
                className="p-3 rounded-lg border bg-card/70 hover:bg-card transition-colors animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={`inline-flex items-center justify-center p-1.5 rounded-md border ${toneClass} mb-2`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="font-semibold text-sm mb-1">{ins.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{ins.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
