import { useMemo } from 'react';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { calculateMetrics } from '@/lib/metricsCalculator';

/**
 * Combined financial metrics including investment positions.
 * Use this in Dashboard/Investments — NOT TransactionsContext.metrics
 * (which is operational-only).
 */
export function useFinancialMetrics() {
  const { filteredTransactions, transactions } = useTransactionsContext();
  const { investments } = useInvestmentsContext();
  const metrics = useMemo(
    () => calculateMetrics(filteredTransactions, investments),
    [filteredTransactions, investments]
  );
  const overallMetrics = useMemo(
    () => calculateMetrics(transactions, investments),
    [transactions, investments]
  );
  return { metrics, overallMetrics };
}
