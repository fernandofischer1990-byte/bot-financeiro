import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  Transaction,
  TransactionMetrics,
  InvestmentSummary,
  FinancialScope,
} from '@/types/finance';
import { Investment } from '@/types/investment';

/** Chave de agrupamento mensal (YYYY-MM) derivada da string ISO, sem timezone. */
export function getMonthKey(isoDate: string): string {
  return (isoDate || '').substring(0, 7);
}

/** Chave do mês corrente (calendário local do usuário). */
export function getCurrentMonthKey(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}

export function getScope(tx: Transaction): FinancialScope {
  return tx.financial_scope ?? (tx.type === 'investment' ? 'investment' : 'operational');
}

export interface MonthTotals {
  income: number;
  expenses: number;
  balance: number;
}

/**
 * Totais operacionais de um mês. Fonte única usada pelo Dashboard (tendências)
 * e por `financialAnalytics.getMonthlyMetrics` — evita cálculos paralelos
 * com regras de escopo divergentes.
 */
export function getOperationalMonthTotals(txs: Transaction[], monthKey: string): MonthTotals {
  let income = 0;
  let expenses = 0;
  for (const tx of txs) {
    if (getScope(tx) !== 'operational') continue;
    if (getMonthKey(tx.transaction_date) !== monthKey) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') income += amount;
    else if (tx.type === 'expense') expenses += amount;
  }
  return { income, expenses, balance: income - expenses };
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return format(new Date(year, (month || 1) - 1, 1), 'MMM/yy', { locale: ptBR });
}

/** Grupo de reconciliação: tipo de investimento + instituição normalizados. */
function groupKey(type?: string | null, institution?: string | null): string {
  return `${(type || 'outros').trim().toLowerCase()}::${(institution || '').trim().toLowerCase()}`;
}

interface ReconciliationGroup {
  type: string;
  positions: number;   // saldo custodiado (tabela investments)
  netFlow: number;     // aportes − resgates (transações de investimento)
  yields: number;      // rendimentos
  losses: number;      // perdas
}

/**
 * Reconciliação `investments` ↔ `transactions`.
 *
 * Posições custodiadas são SALDOS (point-in-time); aportes/resgates são FLUXOS.
 * Somar os dois contaria o mesmo dinheiro duas vezes quando o usuário registra
 * o aporte E cadastra a posição. Regra: por grupo (tipo + instituição),
 * usa-se `max(saldo_das_posições, aportes − resgates)` e soma-se
 * `rendimentos − perdas` por cima. Quando existe apenas uma das fontes,
 * o resultado é exatamente o valor dessa fonte.
 */
export function reconcileInvestments(
  txs: Transaction[],
  investments: Investment[] = []
): { total: number; byType: Record<string, number>; summary: Omit<InvestmentSummary, 'byType'> } {
  const groups = new Map<string, ReconciliationGroup>();
  const ensure = (type: string | null | undefined, institution: string | null | undefined) => {
    const key = groupKey(type, institution);
    let g = groups.get(key);
    if (!g) {
      g = { type: (type || 'outros').trim().toLowerCase(), positions: 0, netFlow: 0, yields: 0, losses: 0 };
      groups.set(key, g);
    }
    return g;
  };

  let deposits = 0;
  let withdraws = 0;
  let yieldTotal = 0;
  let lossTotal = 0;

  for (const tx of txs) {
    if (getScope(tx) !== 'investment') continue;
    const amount = Number(tx.amount) || 0;
    const g = ensure(tx.investment_type, tx.institution);
    switch (tx.investment_operation) {
      case 'deposit':
        deposits += amount;
        g.netFlow += amount;
        break;
      case 'withdraw':
        withdraws += amount;
        g.netFlow -= amount;
        break;
      case 'yield':
        yieldTotal += amount;
        g.yields += amount;
        break;
      case 'loss':
        lossTotal += amount;
        g.losses += amount;
        break;
      default:
        break;
    }
  }

  for (const inv of investments) {
    const g = ensure(inv.investment_type, inv.institution);
    g.positions += Number(inv.initial_amount) || 0;
  }

  const byType: Record<string, number> = {};
  let total = 0;
  for (const g of groups.values()) {
    const base = Math.max(g.positions, g.netFlow);
    const value = base + g.yields - g.losses;
    byType[g.type] = (byType[g.type] || 0) + value;
    total += value;
  }

  return {
    total,
    byType,
    summary: { deposits, withdraws, yields: yieldTotal, losses: lossTotal },
  };
}

/**
 * Métricas financeiras a partir de transações + posições de investimento.
 *
 * - `availableBalance` = Σ(receitas) − Σ(despesas), apenas escopo operacional.
 * - `investedBalance`  = reconciliação posições ↔ transações de investimento.
 * - `netWorth`         = availableBalance + investedBalance.
 * - `byCategory` e `monthlyData` consideram apenas transações operacionais.
 * - `monthlyNetWorth` acumula fluxos por mês; cada posição entra a partir do
 *   mês de sua data de início (ou criação), nunca concentrada no último mês.
 */
export function calculateMetrics(
  txs: Transaction[],
  investments: Investment[] = []
): TransactionMetrics {
  let totalIncome = 0;
  let totalExpenses = 0;
  const byCategory: Record<string, number> = {};
  const monthlyMap: Record<string, { income: number; expenses: number; available: number; invested: number }> = {};

  const ensureMonth = (key: string) => {
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0, available: 0, invested: 0 };
    return monthlyMap[key];
  };

  for (const tx of txs) {
    const amount = Number(tx.amount) || 0;
    const monthKey = getMonthKey(tx.transaction_date);
    if (!monthKey) continue;
    const m = ensureMonth(monthKey);
    const scope = getScope(tx);

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
      const op = tx.investment_operation;
      if (op === 'deposit' || op === 'yield') m.invested += amount;
      else if (op === 'withdraw' || op === 'loss') m.invested -= amount;
    }
  }

  // Posições custodiadas entram na série a partir do mês de início.
  for (const inv of investments) {
    const ref = inv.start_date || inv.created_at || '';
    const monthKey = getMonthKey(ref);
    if (!monthKey) continue;
    ensureMonth(monthKey).invested += Number(inv.initial_amount) || 0;
  }

  const reconciled = reconcileInvestments(txs, investments);

  const availableBalance = totalIncome - totalExpenses;
  const investedBalance = reconciled.total;
  const netWorth = availableBalance + investedBalance;

  const sortedMonths = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b));

  const monthlyData = sortedMonths
    .filter(([, d]) => d.income !== 0 || d.expenses !== 0)
    .slice(-6)
    .map(([monthKey, data]) => ({
      month: monthLabel(monthKey),
      income: data.income,
      expenses: data.expenses,
    }));

  // Patrimônio acumulado: acumula desde o primeiro mês e exibe os 6 últimos.
  let cumAvail = 0;
  let cumInv = 0;
  const series: { month: string; available: number; invested: number; total: number }[] = [];
  for (const [monthKey, d] of sortedMonths) {
    cumAvail += d.available;
    cumInv += d.invested;
    series.push({
      month: monthLabel(monthKey),
      available: cumAvail,
      invested: cumInv,
      total: cumAvail + cumInv,
    });
  }
  const monthlyNetWorth = series.slice(-6);

  const investmentSummary: InvestmentSummary = {
    ...reconciled.summary,
    byType: reconciled.byType,
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
