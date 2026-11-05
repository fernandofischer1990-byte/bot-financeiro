import { describe, it, expect } from 'vitest';
import { computeBalanceImpact } from '../balanceImpact';

describe('computeBalanceImpact', () => {
  it('despesa reduz o saldo disponível', () => {
    expect(computeBalanceImpact({ type: 'expense', amount: 150 }, 2450, 0)).toEqual({ label: 'Saldo disponível', before: 2450, after: 2300 });
  });
  it('receita aumenta o saldo disponível', () => {
    expect(computeBalanceImpact({ type: 'income', amount: 100 }, 1000, 0)?.after).toBe(1100);
  });
  it('aporte sai do saldo disponível', () => {
    expect(computeBalanceImpact({ type: 'investment', amount: 500, investment_operation: 'deposit' }, 1000, 0)?.after).toBe(500);
  });
  it('rendimento altera o saldo investido', () => {
    expect(computeBalanceImpact({ type: 'investment', amount: 20, investment_operation: 'yield' }, 1000, 300)).toEqual({ label: 'Saldo investido', before: 300, after: 320 });
  });
  it('valor zero não mostra impacto', () => {
    expect(computeBalanceImpact({ type: 'expense', amount: 0 }, 1000, 0)).toBeNull();
  });
});
