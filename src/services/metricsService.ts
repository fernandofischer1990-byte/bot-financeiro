import { supabase } from '@/integrations/supabase/client';
import { monthLabel } from '@/lib/metricsCalculator';
import type { TransactionMetrics } from '@/types/finance';

/** Payload bruto devolvido pela função agregada `get_financial_metrics`. */
export interface ServerMetricsPayload {
  total_income: number | string;
  total_expenses: number | string;
  available_balance: number | string;
  invested_balance: number | string;
  net_worth: number | string;
  by_category: Record<string, number | string>;
  by_type: Record<string, number | string>;
  investment_summary: {
    deposits: number | string;
    withdraws: number | string;
    yields: number | string;
    losses: number | string;
  };
  months: Array<{
    month_key: string;
    income: number | string;
    expenses: number | string;
    available: number | string;
    invested: number | string;
  }>;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const numMap = (m: Record<string, number | string> | null | undefined): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m ?? {})) out[k] = num(v);
  return out;
};

/**
 * Converte o resumo agregado do banco no contrato `TransactionMetrics`
 * usado pelo painel. Séries mensais preservam a ordem por `month_key`
 * (sem meses artificiais) e o patrimônio é acumulado mês a mês.
 */
export function mapServerMetrics(payload: ServerMetricsPayload): TransactionMetrics {
  const availableBalance = num(payload.available_balance);
  const investedBalance = num(payload.invested_balance);

  const months = [...(payload.months ?? [])].sort((a, b) =>
    String(a.month_key).localeCompare(String(b.month_key)),
  );

  const monthlyData = months
    .filter((m) => num(m.income) !== 0 || num(m.expenses) !== 0)
    .slice(-6)
    .map((m) => ({
      month: monthLabel(m.month_key),
      income: num(m.income),
      expenses: num(m.expenses),
    }));

  let cumAvail = 0;
  let cumInv = 0;
  const series = months.map((m) => {
    cumAvail += num(m.available);
    cumInv += num(m.invested);
    return {
      month: monthLabel(m.month_key),
      available: cumAvail,
      invested: cumInv,
      total: cumAvail + cumInv,
    };
  });

  return {
    totalBalance: availableBalance,
    availableBalance,
    investedBalance,
    netWorth: num(payload.net_worth),
    totalIncome: num(payload.total_income),
    totalExpenses: num(payload.total_expenses),
    byCategory: numMap(payload.by_category),
    monthlyData,
    monthlyNetWorth: series.slice(-6),
    investmentSummary: {
      deposits: num(payload.investment_summary?.deposits),
      withdraws: num(payload.investment_summary?.withdraws),
      yields: num(payload.investment_summary?.yields),
      losses: num(payload.investment_summary?.losses),
      byType: numMap(payload.by_type),
    },
  };
}

/** Busca o resumo agregado no banco (respeita RLS via `auth.uid()`). */
export async function fetchServerMetrics(
  start?: string | null,
  end?: string | null,
): Promise<{ data: TransactionMetrics | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_financial_metrics', {
    p_start: start ?? null,
    p_end: end ?? null,
  });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: mapServerMetrics(data as unknown as ServerMetricsPayload), error: null };
}
