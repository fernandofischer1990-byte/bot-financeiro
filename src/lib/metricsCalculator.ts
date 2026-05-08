import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, TransactionMetrics, InvestmentSummary } from '@/contexts/TransactionsContext';

/**
 * Calculate financial metrics from a list of transactions.
 * Pure function — no side effects.
 *
 * Available balance = income − expenses − investmentDeposits + investmentWithdraws
 * Invested balance  = deposits − withdraws + yields − losses
 * Net worth         = available + invested
 *
 * Investments are NOT included in byCategory / monthlyData (income vs expenses).
 */
export function calculateMetrics(txs: Transaction[]): TransactionMetrics {
  let totalIncome = 0;
  let totalExpenses = 0;
  let depositTotal = 0;
  let withdrawTotal = 0;
  let yieldTotal = 0;
  let lossTotal = 0;
  const byCategory: Record<string, number> = {};
  const investmentByType: Record<string, number> = {};
  const monthlyMap: Record<string, { income: number; expenses: number; available: number; invested: number }> = {};

  const ensureMonth = (key: string) => {
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0, available: 0, invested: 0 };
    return monthlyMap[key];
  };

  for (const tx of txs) {
    const amount = Number(tx.amount);
    const monthKey = tx.transaction_date.substring(0, 7);
    const m = ensureMonth(monthKey);

    if (tx.type === 'income') {
      totalIncome += amount;
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
      m.income += amount;
      m.available += amount;
    } else if (tx.type === 'expense') {
      totalExpenses += amount;
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
      m.expenses += amount;
      m.available -= amount;
    } else if (tx.type === 'investment') {
      const invType = tx.investment_type || 'outros';
      const op = tx.investment_operation;
      if (op === 'deposit') {
        depositTotal += amount;
        investmentByType[invType] = (investmentByType[invType] || 0) + amount;
        m.available -= amount;
        m.invested += amount;
      } else if (op === 'withdraw') {
        withdrawTotal += amount;
        investmentByType[invType] = (investmentByType[invType] || 0) - amount;
        m.available += amount;
        m.invested -= amount;
      } else if (op === 'yield') {
        yieldTotal += amount;
        investmentByType[invType] = (investmentByType[invType] || 0) + amount;
        m.invested += amount;
      } else if (op === 'loss') {
        lossTotal += amount;
        investmentByType[invType] = (investmentByType[invType] || 0) - amount;
        m.invested -= amount;
      }
    }
  }

  const availableBalance = totalIncome - totalExpenses - depositTotal + withdrawTotal;
  const investedBalance = depositTotal - withdrawTotal + yieldTotal - lossTotal;
  const netWorth = availableBalance + investedBalance;

  const sortedMonths = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b));

  const monthlyData = sortedMonths
    .filter(([, d]) => d.income !== 0 || d.expenses !== 0)
    .slice(-6)
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const localDate = new Date(year, month - 1, 1);
      return {
        month: format(localDate, 'MMM/yy', { locale: ptBR }),
        income: data.income,
        expenses: data.expenses,
      };
    });

  // Cumulative monthly net worth
  let cumAvail = 0;
  let cumInv = 0;
  const monthlyNetWorth = sortedMonths.slice(-6).map(([monthKey, d]) => {
    cumAvail += d.available;
    cumInv += d.invested;
    const [year, month] = monthKey.split('-').map(Number);
    const localDate = new Date(year, month - 1, 1);
    return {
      month: format(localDate, 'MMM/yy', { locale: ptBR }),
      available: cumAvail,
      invested: cumInv,
      total: cumAvail + cumInv,
    };
  });

  const investmentSummary: InvestmentSummary = {
    deposits: depositTotal,
    withdraws: withdrawTotal,
    yields: yieldTotal,
    losses: lossTotal,
    byType: investmentByType,
  };

  return {
    totalBalance: availableBalance,
    availableBalance,
    investedBalance,
    netWorth,
    totalIncome,
    totalExpenses,
    byCategory,
    monthlyData,
    investmentSummary,
    monthlyNetWorth,
  };
}
