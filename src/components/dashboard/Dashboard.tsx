import { MetricCard } from './MetricCard';
import { CategoryChart } from './CategoryChart';
import { MonthlyChart } from './MonthlyChart';
import { TransactionList } from './TransactionList';
import { TransactionMetrics, Transaction } from '@/hooks/useTransactions';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardProps {
  metrics: TransactionMetrics;
  transactions: Transaction[];
  loading: boolean;
  onDeleteTransaction?: (id: string) => void;
}

export function Dashboard({ metrics, transactions, loading, onDeleteTransaction }: DashboardProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[340px] rounded-xl" />
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
        <Skeleton className="h-[450px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Saldo Total"
          value={metrics.totalBalance}
          icon={Wallet}
          variant="default"
        />
        <MetricCard
          title="Total de Receitas"
          value={metrics.totalIncome}
          icon={TrendingUp}
          variant="income"
        />
        <MetricCard
          title="Total de Despesas"
          value={metrics.totalExpenses}
          icon={TrendingDown}
          variant="expense"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart data={metrics.byCategory} />
        <MonthlyChart data={metrics.monthlyData} />
      </div>

      {/* Transaction List */}
      <TransactionList 
        transactions={transactions} 
        onDelete={onDeleteTransaction}
        maxItems={15}
      />
    </div>
  );
}
