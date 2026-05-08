import { useMemo } from 'react';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, TrendingUp, TrendingDown, Coins } from 'lucide-react';
import { formatCurrency, getInvestmentTypeLabel, getInvestmentTypeIcon } from '@/lib/constants';

export function InvestmentsTab() {
  const { transactions, overallMetrics: metrics, deleteTransaction } = useTransactionsContext();

  const investmentTxs = useMemo(
    () => transactions.filter(t => t.type === 'investment'),
    [transactions]
  );

  const summary = metrics.investmentSummary;
  const profit = summary.yields - summary.losses;

  const byType = Object.entries(summary.byType)
    .filter(([, v]) => Math.abs(v) > 0.0001)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Saldo Investido"
          value={metrics.investedBalance}
          icon={Briefcase}
          variant="investment"
        />
        <MetricCard
          title="Rentabilidade"
          value={profit}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          variant={profit >= 0 ? 'income' : 'expense'}
        />
        <MetricCard
          title="Patrimônio Total"
          value={metrics.netWorth}
          icon={Coins}
          variant="networth"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <TransactionForm />
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum investimento registrado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {byType.map(([type, value]) => (
                  <li key={type} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-lg">{getInvestmentTypeIcon(type)}</span>
                      {getInvestmentTypeLabel(type)}
                    </span>
                    <span className={value >= 0 ? 'font-semibold text-primary' : 'font-semibold text-destructive'}>
                      {formatCurrency(value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TransactionList
        transactions={investmentTxs}
        onDelete={deleteTransaction}
        maxItems={50}
      />
    </div>
  );
}
