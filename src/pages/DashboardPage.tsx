import { useNavigate } from 'react-router-dom';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { pathForTab } from '@/components/layout/AppSidebar';

export default function DashboardPage() {
  const {
    filteredTransactions,
    initialLoading,
    hasLoadedOnce,
    loadError,
    filters,
    setFilters,
    deleteTransaction,
    updateTransaction,
    refetch,
  } = useTransactionsContext();
  const { metrics } = useFinancialMetrics();
  const navigate = useNavigate();

  return (
    <Dashboard
      metrics={metrics}
      transactions={filteredTransactions}
      loading={initialLoading || !hasLoadedOnce}
      loadError={loadError}
      filters={filters}
      onFiltersChange={setFilters}
      onDeleteTransaction={deleteTransaction}
      onUpdateTransaction={updateTransaction}
      onRetry={refetch}
      onNavigate={(tab) => navigate(pathForTab(tab))}
    />
  );
}
