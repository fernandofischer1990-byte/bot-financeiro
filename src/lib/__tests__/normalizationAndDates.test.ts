import { describe, it, expect } from 'vitest';
import { normalizeAmount, inferTransactionType } from '@/lib/transactionNormalization';
import { getLocalISODate, parseDateOnly } from '@/lib/dateUtils';

describe('normalizeAmount', () => {
  it('aceita formato brasileiro', () => {
    expect(normalizeAmount('1.234,56')).toBe(1234.56);
  });
  it('aceita formato americano', () => {
    expect(normalizeAmount('1,234.56')).toBe(1234.56);
  });
  it('retorna null para valores inválidos', () => {
    expect(normalizeAmount('abc')).toBeNull();
  });
});

describe('inferTransactionType', () => {
  it('trata valores negativos como despesa', () => {
    expect(inferTransactionType(null, -50)).toBe('expense');
  });
  it('trata valores positivos como receita', () => {
    expect(inferTransactionType(null, 1200)).toBe('income');
  });
});

describe('dateUtils', () => {
  it('formata data local sem deslocar o dia', () => {
    expect(getLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('faz parsing de YYYY-MM-DD como data local', () => {
    const d = parseDateOnly('2026-01-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });
});
