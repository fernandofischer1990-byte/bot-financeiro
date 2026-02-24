import { useState } from 'react';
import { MetricCard } from './MetricCard';
import { CategoryChart } from './CategoryChart';
import { MonthlyChart } from './MonthlyChart';
import { TransactionList } from './TransactionList';
import { DashboardFilters, FilterState, defaultFilters } from './DashboardFilters';
import { EditTransactionDialog } from './EditTransactionDialog';
import { TransactionMetrics, Transaction } from '@/contexts/TransactionsContext';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface DashboardProps {
  metrics: TransactionMetrics;
  transactions: Transaction[];
  loading: boolean;
  loadError?: string | null;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onDeleteTransaction?: (id: string) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
  onRetry?: () => void;
}

export function Dashboard({ 
  metrics, 
  transactions, 
  loading, 
  loadError,
  filters,
  onFiltersChange,
  onDeleteTransaction,
  onUpdateTransaction,
  onRetry
}: DashboardProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Mostrar erro com opção de retry se houver problema no carregamento */}
        {loadError && (
          <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-destructive font-medium mb-1">Não foi possível carregar suas transações</p>
            <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                Recarregar página
              </Button>
            </div>
          </div>
        )}
        {!loadError && (
          <>
            <Skeleton className="h-[60px] rounded-xl" />
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
          </>
        )}
      </div>
    );
  }

  const handleSaveTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (onUpdateTransaction) {
      const success = await onUpdateTransaction(id, updates);
      if (success) {
        setEditingTransaction(null);
      }
      return success;
    }
    return false;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <DashboardFilters filters={filters} onFiltersChange={onFiltersChange} />

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
        onEdit={setEditingTransaction}
        maxItems={15}
        hasActiveFilters={filters.period !== 'all' || filters.type !== 'all' || filters.category !== 'all'}
        onClearFilters={() => onFiltersChange({
          period: 'all',
          type: 'all',
          category: 'all',
          startDate: null,
          endDate: null,
        })}
      />

      {/* Edit Dialog */}
      <EditTransactionDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        onSave={handleSaveTransaction}
      />
    </div>
  );
}
