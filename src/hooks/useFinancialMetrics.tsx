import { useEffect, useMemo, useState } from 'react';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { calculateMetrics } from '@/lib/metricsCalculator';
import { fetchServerMetrics } from '@/services/metricsService';
import { logger } from '@/lib/logger';
import type { TransactionMetrics } from '@/types/finance';

function toISODate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Métricas financeiras combinadas (transações + posições de investimento).
 *
 * O resumo agregado no banco (`get_financial_metrics`) é a fonte autoritativa
 * de totais, séries mensais e aportes. O cálculo local segue existindo como
 * fallback imediato (primeira renderização, offline ou erro de rede).
 */
export function useFinancialMetrics() {
  const { filteredTransactions, transactions, filters } = useTransactionsContext();
  const { investments } = useInvestmentsContext();

  const localMetrics = useMemo(
    () => calculateMetrics(filteredTransactions, investments),
    [filteredTransactions, investments]
  );
  const localOverall = useMemo(
    () => calculateMetrics(transactions, investments),
    [transactions, investments]
  );

  const start = toISODate(filters.startDate);
  const end = toISODate(filters.endDate);

  // Assinatura de mudança: refaz a agregação quando dados mudam de fato.
  const dataKey = useMemo(() => {
    const last = transactions.reduce((acc, t) => (t.updated_at > acc ? t.updated_at : acc), '');
    const lastInv = investments.reduce((acc, i) => (i.updated_at > acc ? i.updated_at : acc), '');
    return `${transactions.length}|${last}|${investments.length}|${lastInv}`;
  }, [transactions, investments]);

  const [serverMetrics, setServerMetrics] = useState<TransactionMetrics | null>(null);
  const [serverOverall, setServerOverall] = useState<TransactionMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [scoped, overall] = await Promise.all([
        fetchServerMetrics(start, end),
        start || end ? fetchServerMetrics(null, null) : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      if (scoped.error) {
        logger.debug(`[Metrics] RPC falhou, usando cálculo local: ${scoped.error}`);
        setServerMetrics(null);
        setServerOverall(null);
        return;
      }
      setServerMetrics(scoped.data);
      setServerOverall(overall.data ?? scoped.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end, dataKey]);

  return {
    metrics: serverMetrics ?? localMetrics,
    overallMetrics: serverOverall ?? localOverall,
    localMetrics,
    isServerMetrics: serverMetrics !== null,
  };
}
