import { describe, it, expect } from 'vitest';
import { maskCurrencyInput, parseCurrencyInput, maskCnpj, isCnpjComplete, buildInstitutionSuggestions } from '../inputMasks';

describe('inputMasks', () => {
  it('mascara moeda preenchendo centavos', () => {
    expect(maskCurrencyInput('123456')).toBe('1.234,56');
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56);
  });
  it('mascara CNPJ', () => {
    expect(maskCnpj('12345678000199')).toBe('12.345.678/0001-99');
  });
  it('CNPJ incompleto é inválido, vazio é aceito', () => {
    expect(isCnpjComplete('12.345')).toBe(false);
    expect(isCnpjComplete('')).toBe(true);
  });
  it('não duplica instituições ignorando caixa', () => {
    const s = buildInstitutionSuggestions(['nubank']);
    expect(s.filter(x => x.toLowerCase() === 'nubank')).toHaveLength(1);
  });
});
