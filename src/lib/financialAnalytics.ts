import { Transaction } from '@/contexts/TransactionsContext';
import { getLocalISODate } from '@/lib/dateUtils';

// ── Monthly metrics (current calendar month) ────────────────────────

export interface MonthlyMetrics {
  income_month: number;
  expenses_month: number;
  balance_month: number;
}

export function getMonthlyMetrics(txs: Transaction[]): MonthlyMetrics {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let income = 0;
  let expenses = 0;

  for (const tx of txs) {
    if (!tx.transaction_date.startsWith(prefix)) continue;
    const amt = Number(tx.amount);
    if (tx.type === 'income') income += amt;
    else expenses += amt;
  }

  return { income_month: income, expenses_month: expenses, balance_month: income - expenses };
}

// ── Previous month metrics (for comparison) ─────────────────────────

function getPreviousMonthMetrics(txs: Transaction[]): { byCategory: Record<string, number>; totalExpenses: number } {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prefix = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const byCategory: Record<string, number> = {};
  let totalExpenses = 0;

  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.transaction_date.startsWith(prefix)) continue;
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
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const map: Record<string, number> = {};

  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.transaction_date.startsWith(prefix)) continue;
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

// ── Budget awareness (placeholder) ──────────────────────────────────

export function computeBudgetAwareness(): { configured: false; message: string } {
  return {
    configured: false,
    message: 'Orçamentos não configurados. Você pode definir metas de gastos por categoria no futuro!',
  };
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
