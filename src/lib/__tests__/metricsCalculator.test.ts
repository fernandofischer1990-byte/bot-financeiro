import { describe, it, expect } from 'vitest';
import {
  calculateMetrics,
  reconcileInvestments,
  getOperationalMonthTotals,
  getMonthKey,
} from '@/lib/metricsCalculator';
import type { Transaction } from '@/types/finance';
import type { Investment } from '@/types/investment';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    type: 'expense',
    amount: 0,
    category: 'outros_despesa',
    description: null,
    transaction_date: '2026-01-15',
    source: 'manual',
    created_at: '2026-01-15T12:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
    financial_scope: 'operational',
    ...partial,
  } as Transaction;
}

function inv(partial: Partial<Investment>): Investment {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    investment_name: 'Posição',
    investment_type: 'cdb',
    institution: null,
    initial_amount: 0,
    start_date: '2026-01-01',
    end_date: null,
    term_days: null,
    term_months: null,
    term_years: null,
    metadata: {},
    imported_from: 'manual',
    source_file_name: null,
    imported_at: null,
    created_at: '2026-01-01T12:00:00Z',
    updated_at: '2026-01-01T12:00:00Z',
    ...partial,
  } as Investment;
}

describe('getMonthKey', () => {
  it('agrupa pela string ISO, sem depender de timezone', () => {
    expect(getMonthKey('2025-12-31')).toBe('2025-12');
    expect(getMonthKey('2026-01-01')).toBe('2026-01');
  });
});

describe('getOperationalMonthTotals', () => {
  it('soma apenas transações operacionais do mês pedido', () => {
    const txs = [
      tx({ type: 'income', amount: 5000, transaction_date: '2026-01-05' }),
      tx({ type: 'expense', amount: 1200, transaction_date: '2026-01-20' }),
      tx({ type: 'expense', amount: 900, transaction_date: '2025-12-20' }),
      tx({ type: 'investment', amount: 3000, financial_scope: 'investment', investment_operation: 'deposit', transaction_date: '2026-01-10' }),
    ];
    expect(getOperationalMonthTotals(txs, '2026-01')).toEqual({ income: 5000, expenses: 1200, balance: 3800 });
  });
});

describe('calculateMetrics — saldo disponível', () => {
  it('ignora transações de investimento no saldo disponível', () => {
    const m = calculateMetrics([
      tx({ type: 'income', amount: 10000 }),
      tx({ type: 'expense', amount: 2500 }),
      tx({ type: 'investment', amount: 4000, financial_scope: 'investment', investment_operation: 'deposit', investment_type: 'cdb' }),
    ]);
    expect(m.availableBalance).toBe(7500);
    expect(m.totalBalance).toBe(7500);
    expect(m.investedBalance).toBe(4000);
    expect(m.netWorth).toBe(11500);
  });

  it('não cria meses artificiais na série mensal', () => {
    const m = calculateMetrics([
      tx({ type: 'income', amount: 100, transaction_date: '2025-10-05' }),
      tx({ type: 'income', amount: 200, transaction_date: '2026-01-05' }),
    ]);
    expect(m.monthlyData).toHaveLength(2);
  });
});

describe('reconcileInvestments', () => {
  it('não conta em dobro aporte e posição do mesmo grupo', () => {
    const r = reconcileInvestments(
      [tx({ type: 'investment', amount: 5000, financial_scope: 'investment', investment_operation: 'deposit', investment_type: 'cdb', institution: 'Banco X' })],
      [inv({ investment_type: 'cdb', institution: 'Banco X', initial_amount: 5000 })],
    );
    expect(r.total).toBe(5000);
    expect(r.byType.cdb).toBe(5000);
  });

  it('soma grupos distintos e aplica rendimentos e perdas', () => {
    const r = reconcileInvestments(
      [
        tx({ type: 'investment', amount: 1000, financial_scope: 'investment', investment_operation: 'yield', investment_type: 'cdb', institution: 'Banco X' }),
        tx({ type: 'investment', amount: 200, financial_scope: 'investment', investment_operation: 'loss', investment_type: 'acoes', institution: 'Corretora Y' }),
      ],
      [
        inv({ investment_type: 'cdb', institution: 'Banco X', initial_amount: 5000 }),
        inv({ investment_type: 'acoes', institution: 'Corretora Y', initial_amount: 3000 }),
      ],
    );
    expect(r.total).toBe(5000 + 1000 + 3000 - 200);
    expect(r.summary).toEqual({ deposits: 0, withdraws: 0, yields: 1000, losses: 200 });
  });

  it('usa apenas o fluxo quando não há posição cadastrada', () => {
    const r = reconcileInvestments([
      tx({ type: 'investment', amount: 8000, financial_scope: 'investment', investment_operation: 'deposit', investment_type: 'tesouro_direto' }),
      tx({ type: 'investment', amount: 3000, financial_scope: 'investment', investment_operation: 'withdraw', investment_type: 'tesouro_direto' }),
    ]);
    expect(r.total).toBe(5000);
  });
});

describe('calculateMetrics — patrimônio acumulado', () => {
  it('posiciona a posição custodiada no mês de início, não no último mês', () => {
    const m = calculateMetrics(
      [
        tx({ type: 'income', amount: 1000, transaction_date: '2025-11-05' }),
        tx({ type: 'income', amount: 1000, transaction_date: '2025-12-05' }),
      ],
      [inv({ investment_type: 'cdb', initial_amount: 2000, start_date: '2025-11-10' })],
    );
    const nov = m.monthlyNetWorth[0];
    expect(nov.invested).toBe(2000);
    expect(nov.total).toBe(3000);
    expect(m.monthlyNetWorth[1].total).toBe(4000);
  });
});
