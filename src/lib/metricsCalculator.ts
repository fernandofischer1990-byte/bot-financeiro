import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, TransactionMetrics } from '@/contexts/TransactionsContext';

/**
 * Calculate financial metrics from a list of transactions.
 * Pure function — no side effects.
 */
export function calculateMetrics(txs: Transaction[]): TransactionMetrics {
  let totalIncome = 0;
  let totalExpenses = 0;
  const byCategory: Record<string, number> = {};
  const monthlyMap: Record<string, { income: number; expenses: number }> = {};

  for (const tx of txs) {
    const amount = Number(tx.amount);

    if (tx.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
    }

    byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;

    const monthKey = tx.transaction_date.substring(0, 7);
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { income: 0, expenses: 0 };
    }
    if (tx.type === 'income') {
      monthlyMap[monthKey].income += amount;
    } else {
      monthlyMap[monthKey].expenses += amount;
    }
  }

  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const localDate = new Date(year, month - 1, 1);
      return {
        month: format(localDate, 'MMM/yy', { locale: ptBR }),
        ...data,
      };
    });

  return {
    totalBalance: totalIncome - totalExpenses,
    totalIncome,
    totalExpenses,
    byCategory,
    monthlyData,
  };
}
