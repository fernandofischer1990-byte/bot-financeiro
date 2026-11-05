import { describe, it, expect } from 'vitest';
import { getDateRange } from '../duplicateDetector';
describe('getDateRange', () => {
  it('retorna a menor e a maior data do arquivo', () => {
    expect(getDateRange([{ date: '2026-10-05' }, { date: '2026-09-16' }, { date: '2026-10-26' }]))
      .toEqual({ startDate: '2026-09-16', endDate: '2026-10-26' });
  });
  it('retorna null sem datas válidas', () => {
    expect(getDateRange([{ date: '' }])).toBeNull();
  });
});
