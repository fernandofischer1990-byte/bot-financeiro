import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, TransactionMetrics, InvestmentSummary } from '@/contexts/TransactionsContext';
import { Investment } from '@/types/investment';

/**
 * Calculate financial metrics from transactions + investment positions.
 *
 * Strict rules:
 * - availableBalance = Σ(income) − Σ(expenses) — ONLY financial_scope === 'operational'
 * - investedBalance  = Σ(current_balance of investments)
 *                    + Σ(transaction deltas with financial_scope === 'investment')
 *                      (deposit + yield positive; withdraw + loss negative)
 *                    — investment transactions never touch availableBalance.
 * - netWorth         = availableBalance + investedBalance
 * - byCategory & monthlyData consider ONLY operational transactions.
 */
export function calculateMetrics(
  txs: Transaction[],
  investments: Investment[] = []
): TransactionMetrics {
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
    const scope = tx.financial_scope ?? (tx.type === 'investment' ? 'investment' : 'operational');

    if (scope === 'operational' && tx.type === 'income') {
      totalIncome += amount;
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
      m.income += amount;
      m.available += amount;
    } else if (scope === 'operational' && tx.type === 'expense') {
      totalExpenses += amount;
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
      m.expenses += amount;
      m.available -= amount;
    } else if (scope === 'investment') {
      const invType = tx.investment_type || 'outros';
      const op = tx.investment_operation;
      if (op === 'deposit') {
        depositTotal += amount;
        investmentByType[invType] = (investmentByType[invType] || 0) + amount;
        m.invested += amount;
      } else if (op === 'withdraw') {
        withdrawTotal += amount;
        investmentByType[invType] = (investmentByType[invType] || 0) - amount;
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

  // Investment positions (from investments table) — these are point-in-time balances.
  let positionsTotal = 0;
  for (const inv of investments) {
    const balance = Number(inv.current_balance) || 0;
    positionsTotal += balance;
    const t = inv.investment_type || 'outros';
    investmentByType[t] = (investmentByType[t] || 0) + balance;
  }

  const availableBalance = totalIncome - totalExpenses;
  const investedBalance = positionsTotal + depositTotal - withdrawTotal + yieldTotal - lossTotal;
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

  // Cumulative monthly net worth — uses ONLY transaction-driven deltas.
  // Positions (current_balance) are added as a fixed offset on the latest month.
  let cumAvail = 0;
  let cumInv = 0;
  const trail = sortedMonths.slice(-6);
  const monthlyNetWorth = trail.map(([monthKey, d], i) => {
    cumAvail += d.available;
    cumInv += d.invested;
    const baseInv = i === trail.length - 1 ? cumInv + positionsTotal : cumInv;
    const [year, month] = monthKey.split('-').map(Number);
    const localDate = new Date(year, month - 1, 1);
    return {
      month: format(localDate, 'MMM/yy', { locale: ptBR }),
      available: cumAvail,
      invested: baseInv,
      total: cumAvail + baseInv,
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
