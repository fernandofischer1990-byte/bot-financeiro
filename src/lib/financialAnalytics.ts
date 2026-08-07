import { Transaction } from '@/contexts/TransactionsContext';
import { getLocalISODate } from '@/lib/dateUtils';
import {
  getCurrentMonthKey,
  getMonthKey,
  getOperationalMonthTotals,
  getScope,
} from '@/lib/metricsCalculator';

// ── Monthly metrics (current calendar month) ────────────────────────

export interface MonthlyMetrics {
  income_month: number;
  expenses_month: number;
  balance_month: number;
}

export function getMonthlyMetrics(txs: Transaction[]): MonthlyMetrics {
  const totals = getOperationalMonthTotals(txs, getCurrentMonthKey());
  return {
    income_month: totals.income,
    expenses_month: totals.expenses,
    balance_month: totals.balance,
  };
}

// ── Previous month metrics (for comparison) ─────────────────────────

function getPreviousMonthMetrics(txs: Transaction[]): { byCategory: Record<string, number>; totalExpenses: number } {
  const now = new Date();
  const prefix = getCurrentMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const byCategory: Record<string, number> = {};
  let totalExpenses = 0;

  for (const tx of txs) {
    if (tx.type !== 'expense' || getScope(tx) !== 'operational') continue;
    if (getMonthKey(tx.transaction_date) !== prefix) continue;
    const amt = Number(tx.amount);
    byCategory[tx.category] = (byCategory[tx.category] || 0) + amt;
    totalExpenses += amt;
  }

  return { byCategory, totalExpenses };
}

// ── Savings rate ────────────────────────────────────────────────────

export function getSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return Math.round(((income - expenses) / income) * 100);
}

// ── Top categories for current month ────────────────────────────────

export interface CategoryAmount {
  category: string;
  amount: number;
}

export function getTopCategories(txs: Transaction[], limit = 5): CategoryAmount[] {
  const prefix = getCurrentMonthKey();
  const map: Record<string, number> = {};

  for (const tx of txs) {
    if (tx.type !== 'expense' || getScope(tx) !== 'operational') continue;
    if (getMonthKey(tx.transaction_date) !== prefix) continue;
    map[tx.category] = (map[tx.category] || 0) + Number(tx.amount);
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([category, amount]) => ({ category, amount }));
}

// ── Financial Health Score (0–100) ──────────────────────────────────

export interface HealthScore {
  score: number;
  factors: {
    savingsRate: number;       // 0–40 pts
    diversification: number;   // 0–30 pts
    incomeStability: number;   // 0–30 pts
  };
}

export function getFinancialHealthScore(txs: Transaction[]): HealthScore {
  const monthly = getMonthlyMetrics(txs);
  const savingsRate = getSavingsRate(monthly.income_month, monthly.expenses_month);

  // Factor 1: Savings rate (0–40 pts)
  const savingsPts = Math.min(40, Math.round(savingsRate * 0.4));

  // Factor 2: Spending diversification — lower concentration = better (0–30 pts)
  const cats = getTopCategories(txs, 20);
  const totalCatSpending = cats.reduce((s, c) => s + c.amount, 0);
  let concentrationPts = 30;
  if (totalCatSpending > 0 && cats.length > 0) {
    const topShare = cats[0].amount / totalCatSpending;
    // If top cat > 60% = bad, < 25% = great
    concentrationPts = Math.round(30 * Math.max(0, Math.min(1, (0.65 - topShare) / 0.4)));
  }

  // Factor 3: Income presence (0–30 pts)
  const hasIncome = monthly.income_month > 0 ? 30 : 0;

  const score = Math.min(100, savingsPts + concentrationPts + hasIncome);
  return { score, factors: { savingsRate: savingsPts, diversification: concentrationPts, incomeStability: hasIncome } };
}

// ── Spending Insights ───────────────────────────────────────────────

export function detectSpendingInsights(txs: Transaction[]): string[] {
  const insights: string[] = [];
  const monthly = getMonthlyMetrics(txs);
  const savingsRate = getSavingsRate(monthly.income_month, monthly.expenses_month);
  const topCats = getTopCategories(txs);
  const today = getLocalISODate();

  // 1. Low savings rate
  if (monthly.income_month > 0 && savingsRate < 10) {
    insights.push(`⚠️ Sua taxa de poupança este mês é de apenas ${savingsRate}%. Tente reduzir gastos para economizar mais.`);
  }

  // 2. Category concentration > 40%
  if (monthly.expenses_month > 0 && topCats.length > 0) {
    const topShare = Math.round((topCats[0].amount / monthly.expenses_month) * 100);
    if (topShare > 40) {
      insights.push(`📊 Você concentra ${topShare}% dos gastos em "${topCats[0].category}". Considere diversificar.`);
    }
  }

  // 3. Spending spikes vs income
  if (monthly.income_month > 0) {
    for (const cat of topCats) {
      const pct = Math.round((cat.amount / monthly.income_month) * 100);
      if (pct > 20) {
        insights.push(`🔍 Gastos com "${cat.category}" representam ${pct}% da sua renda mensal.`);
        break; // only report the worst one
      }
    }
  }

  // 4. Large single transaction today
  const todayTxs = txs.filter(t => t.type === 'expense' && t.transaction_date === today);
  if (monthly.income_month > 0) {
    for (const tx of todayTxs) {
      const pct = Math.round((Number(tx.amount) / monthly.income_month) * 100);
      if (pct > 20) {
        insights.push(`💰 Uma compra hoje de R$ ${Number(tx.amount).toFixed(2)} representa ${pct}% da sua renda mensal.`);
        break;
      }
    }
  }

  // 5. Compare with previous month
  const prev = getPreviousMonthMetrics(txs);
  if (prev.totalExpenses > 0 && monthly.expenses_month > prev.totalExpenses * 1.3) {
    const pctIncrease = Math.round(((monthly.expenses_month - prev.totalExpenses) / prev.totalExpenses) * 100);
    insights.push(`📈 Seus gastos aumentaram ${pctIncrease}% comparado ao mês anterior.`);
  }

  return insights.slice(0, 5);
}

// ── Budget awareness ────────────────────────────────────────────────

export interface BudgetStatus {
  category: string;
  budget: number;
  spent: number;
  /** Percentual consumido do orçamento (pode passar de 100). */
  pct: number;
  remaining: number;
  level: 'ok' | 'warning' | 'exceeded';
}

export interface BudgetAwareness {
  configured: boolean;
  message: string;
  statuses: BudgetStatus[];
}

/**
 * Compara os gastos operacionais do mês com os orçamentos definidos por categoria.
 * `monthKey` no formato YYYY-MM; usa apenas o prefixo da data (sem timezone local).
 */
export function computeBudgetAwareness(
  txs: Transaction[],
  budgets: Array<{ category: string; amount: number }>,
  monthKey: string
): BudgetAwareness {
  if (budgets.length === 0) {
    return {
      configured: false,
      message: 'Orçamentos não configurados. Defina metas de gastos por categoria para acompanhar seu mês.',
      statuses: [],
    };
  }

  const spentByCategory = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== 'expense') continue;
    if ((tx.financial_scope ?? 'operational') !== 'operational') continue;
    if (!tx.transaction_date?.startsWith(monthKey)) continue;
    spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + Number(tx.amount));
  }

  const statuses: BudgetStatus[] = budgets.map((b) => {
    const spent = spentByCategory.get(b.category) ?? 0;
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    return {
      category: b.category,
      budget: b.amount,
      spent,
      pct,
      remaining: b.amount - spent,
      level: pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'ok',
    };
  });

  const exceeded = statuses.filter((s) => s.level === 'exceeded');
  const warning = statuses.filter((s) => s.level === 'warning');

  const message = exceeded.length
    ? `${exceeded.length} categoria(s) acima do orçamento neste mês.`
    : warning.length
      ? `${warning.length} categoria(s) próxima(s) do limite do orçamento.`
      : 'Todos os orçamentos do mês estão sob controle.';

  return { configured: true, message, statuses };
}

// ── Spending alert for a single transaction ─────────────────────────

export function getSpendingAlert(amount: number, incomeMonth: number): string | null {
  if (incomeMonth <= 0 || amount <= 0) return null;
  const pct = Math.round((amount / incomeMonth) * 100);
  if (pct >= 20) {
    return `⚠️ Esta compra representa ${pct}% da sua renda mensal.`;
  }
  return null;
}
