import { describe, it, expect } from 'vitest';
import { estimateCurrentValue, effectiveAnnualRate } from '../investmentValuation';

const ref = { cdi: 10, selic: 10, ipca: 5 };
const base = { initial_amount: 1000, start_date: '2025-01-01', end_date: null };

describe('investmentValuation', () => {
  it('110% do CDI com CDI 10% rende 11% a.a.', () => {
    expect(effectiveAnnualRate('cdi', 110, ref)).toBeCloseTo(11);
  });
  it('IPCA + 5% com IPCA 5% compõe 10,25% a.a.', () => {
    expect(effectiveAnnualRate('ipca', 5, ref)).toBeCloseTo(10.25);
  });
  it('prefixado 12% por 365 dias vira 1.120,00', () => {
    expect(estimateCurrentValue({ ...base, metadata: { indexer: 'pre', indexer_rate: 12 } }, ref, '2026-01-01')).toBe(1120);
  });
  it('para de render no vencimento', () => {
    const v = estimateCurrentValue({ ...base, end_date: '2026-01-01', metadata: { indexer: 'pre', indexer_rate: 12 } }, ref, '2030-01-01');
    expect(v).toBe(1120);
  });
  it('sem indexador mantém o valor aplicado', () => {
    expect(estimateCurrentValue({ ...base, metadata: {} }, ref, '2026-01-01')).toBe(1000);
  });
});
