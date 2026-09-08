import { describe, it, expect } from 'vitest';
import { mapServerMetrics, type ServerMetricsPayload } from '@/services/metricsService';

const payload: ServerMetricsPayload = {
  total_income: '5000',
  total_expenses: '2000',
  available_balance: '3000',
  invested_balance: '1500',
  net_worth: '4500',
  by_category: { alimentacao: '800', moradia: 1200 },
  by_type: { cdb: '1000', acoes: 500 },
  investment_summary: { deposits: '1200', withdraws: '200', yields: '80', losses: '0' },
  months: [
    { month_key: '2026-02', income: '2000', expenses: '1000', available: '1000', invested: '500' },
    { month_key: '2026-01', income: '3000', expenses: '1000', available: '2000', invested: '1000' },
  ],
};

describe('mapServerMetrics', () => {
  it('converte totais (strings numéricas do Postgres) em números', () => {
    const m = mapServerMetrics(payload);
    expect(m.totalIncome).toBe(5000);
    expect(m.totalExpenses).toBe(2000);
    expect(m.availableBalance).toBe(3000);
    expect(m.totalBalance).toBe(3000);
    expect(m.investedBalance).toBe(1500);
    expect(m.netWorth).toBe(4500);
    expect(m.byCategory).toEqual({ alimentacao: 800, moradia: 1200 });
  });

  it('ordena as séries mensais e não cria meses artificiais', () => {
    const m = mapServerMetrics(payload);
    expect(m.monthlyData).toHaveLength(2);
    expect(m.monthlyData[0].income).toBe(3000); // 2026-01 primeiro
    expect(m.monthlyData[1].income).toBe(2000);
  });

  it('acumula o patrimônio mês a mês', () => {
    const m = mapServerMetrics(payload);
    expect(m.monthlyNetWorth[0]).toMatchObject({ available: 2000, invested: 1000, total: 3000 });
    expect(m.monthlyNetWorth[1]).toMatchObject({ available: 3000, invested: 1500, total: 4500 });
  });

  it('mapeia aportes, resgates, rendimentos e distribuição por tipo', () => {
    const m = mapServerMetrics(payload);
    expect(m.investmentSummary).toEqual({
      deposits: 1200,
      withdraws: 200,
      yields: 80,
      losses: 0,
      byType: { cdb: 1000, acoes: 500 },
    });
  });

  it('tolera payload vazio sem quebrar', () => {
    const m = mapServerMetrics({
      total_income: 0, total_expenses: 0, available_balance: 0, invested_balance: 0,
      net_worth: 0, by_category: {}, by_type: {},
      investment_summary: { deposits: 0, withdraws: 0, yields: 0, losses: 0 },
      months: [],
    });
    expect(m.monthlyData).toEqual([]);
    expect(m.monthlyNetWorth).toEqual([]);
    expect(m.netWorth).toBe(0);
  });
});
