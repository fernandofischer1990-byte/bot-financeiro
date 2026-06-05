import { useState, useMemo } from 'react';
import { MetricCard } from './MetricCard';
import { CategoryChart } from './CategoryChart';
import { MonthlyChart } from './MonthlyChart';
import { PatrimonyDistributionChart } from './PatrimonyDistributionChart';
import { NetWorthChart } from './NetWorthChart';
import { TransactionList } from './TransactionList';
import { DashboardFilters, FilterState } from './DashboardFilters';
import { EditTransactionDialog } from './EditTransactionDialog';
import { EmptyState } from './EmptyState';
import { InsightsPanel } from './InsightsPanel';
import { TransactionMetrics, Transaction } from '@/contexts/TransactionsContext';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import {
  Wallet, Briefcase, Coins, TrendingUp, TrendingDown, RefreshCw, AlertCircle,
  PiggyBank, Percent, Plus, Upload,
} from 'lucide-react';
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
  onNavigate?: (tab: string) => void;
}

function pct(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
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
  onRetry,
  onNavigate,
}: DashboardProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { investments } = useInvestmentsContext();
  const { transactions: allTransactions } = useTransactionsContext();

  // Month-over-month
  const trends = useMemo(() => {
    const curr = new Date();
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const ck = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
    const pk = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    let cInc = 0, cExp = 0, pInc = 0, pExp = 0;
    for (const t of allTransactions) {
      if ((t.financial_scope ?? 'operational') !== 'operational') continue;
      const mk = t.transaction_date.substring(0, 7);
      const amt = Number(t.amount);
      if (mk === ck) {
        if (t.type === 'income') cInc += amt;
        if (t.type === 'expense') cExp += amt;
      } else if (mk === pk) {
        if (t.type === 'income') pInc += amt;
        if (t.type === 'expense') pExp += amt;
      }
    }
    return {
      balanceTrend: pct(cInc - cExp, pInc - pExp),
      incomeTrend: pct(cInc, pInc),
      expenseTrend: pct(cExp, pExp),
      currMonthIncome: cInc,
      currMonthExpense: cExp,
      monthSavings: cInc - cExp,
      savingsRate: cInc > 0 ? ((cInc - cExp) / cInc) * 100 : 0,
    };
  }, [allTransactions]);

  if (loading) {
    return (
      <div className="space-y-6">
        {loadError ? (
          <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-destructive font-medium mb-1">Não foi possível carregar suas transações</p>
            <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>Recarregar página</Button>
            </div>
          </div>
        ) : (
          <>
            <Skeleton className="h-[60px] rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
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

  if (allTransactions.length === 0 && investments.length === 0 && !loadError) {
    return (
      <EmptyState
        icon={Wallet}
        title="Vamos começar?"
        description="Nenhum dado financeiro ainda. Registre sua primeira movimentação, importe um extrato ou cadastre um investimento."
        actions={
          <>
            <Button onClick={() => onNavigate?.('add')}>
              <Plus className="h-4 w-4 mr-1" /> Nova transação
            </Button>
            <Button variant="outline" onClick={() => onNavigate?.('import')}>
              <Upload className="h-4 w-4 mr-1" /> Importar extrato
            </Button>
            <Button variant="ghost" onClick={() => onNavigate?.('investments')}>
              <Briefcase className="h-4 w-4 mr-1" /> Cadastrar investimento
            </Button>
          </>
        }
      />
    );
  }

  const handleSaveTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!onUpdateTransaction) return false;
    const ok = await onUpdateTransaction(id, updates);
    if (ok) setEditingTransaction(null);
    return ok;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardFilters filters={filters} onFiltersChange={onFiltersChange} />

      <InsightsPanel transactions={allTransactions} metrics={metrics} investments={investments} />

      {/* Patrimônio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Saldo Disponível"
          value={metrics.availableBalance}
          icon={Wallet}
          variant="default"
          subtitle="Dinheiro imediatamente utilizável"
          trend={trends.balanceTrend != null ? { value: trends.balanceTrend } : null}
        />
        <MetricCard
          title="Investimentos"
          value={metrics.investedBalance}
          icon={Briefcase}
          variant="investment"
          subtitle={`${investments.length} ativo${investments.length === 1 ? '' : 's'} cadastrado${investments.length === 1 ? '' : 's'}`}
        />
        <MetricCard
          title="Patrimônio Total"
          value={metrics.netWorth}
          icon={Coins}
          variant="networth"
          subtitle="Saldo + Investimentos"
        />
      </div>

      {/* Operacional do mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Receitas do mês"
          value={trends.currMonthIncome}
          icon={TrendingUp}
          variant="income"
          trend={trends.incomeTrend != null ? { value: trends.incomeTrend } : null}
        />
        <MetricCard
          title="Despesas do mês"
          value={trends.currMonthExpense}
          icon={TrendingDown}
          variant="expense"
          trend={trends.expenseTrend != null ? { value: -trends.expenseTrend } : null}
        />
        <MetricCard
          title="Economia do mês"
          value={trends.monthSavings}
          icon={PiggyBank}
          variant={trends.monthSavings >= 0 ? 'income' : 'expense'}
        />
        <MetricCard
          title="Taxa de poupança"
          value={trends.savingsRate}
          icon={Percent}
          variant={trends.savingsRate >= 20 ? 'income' : trends.savingsRate >= 0 ? 'default' : 'expense'}
          format="percent"
          subtitle={trends.savingsRate >= 20 ? 'Saudável (≥20%)' : 'Meta: 20%'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart data={metrics.byCategory} />
        <MonthlyChart data={metrics.monthlyData} />
        <PatrimonyDistributionChart available={metrics.availableBalance} invested={metrics.investedBalance} />
        <NetWorthChart data={metrics.monthlyNetWorth} />
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma movimentação no filtro atual"
          description="Ajuste o período ou limpe os filtros para visualizar suas transações."
          actions={
            <Button variant="outline" onClick={() => onFiltersChange({ period: 'all', type: 'all', category: 'all', startDate: null, endDate: null })}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <TransactionList
          transactions={transactions}
          onDelete={onDeleteTransaction}
          onEdit={setEditingTransaction}
          maxItems={15}
          hasActiveFilters={filters.period !== 'all' || filters.type !== 'all' || filters.category !== 'all'}
          onClearFilters={() => onFiltersChange({ period: 'all', type: 'all', category: 'all', startDate: null, endDate: null })}
        />
      )}

      <EditTransactionDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        onSave={handleSaveTransaction}
      />
    </div>
  );
}
