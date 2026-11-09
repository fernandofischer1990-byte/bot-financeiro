// Máscaras de entrada para formulários financeiros (padrão BR).

/** Formata dígitos digitados como moeda BR, preenchendo da direita (centavos). "123456" → "1.234,56". */
export function maskCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
  if (!digits) return '';
  const cents = Number(digits) / 100;
  return cents.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte número em texto mascarado para preencher o campo na edição. */
export function formatCurrencyInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" → 1234.56 ; vazio → 0 */
export function parseCurrencyInput(masked: string): number {
  const digits = masked.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

/** Máscara progressiva de CNPJ: 00.000.000/0000-00 */
export function maskCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '.' + d.slice(2, 5);
  if (d.length > 5) out += '.' + d.slice(5, 8);
  if (d.length > 8) out += '/' + d.slice(8, 12);
  if (d.length > 12) out += '-' + d.slice(12, 14);
  return out;
}

/** CNPJ vazio é aceito (campo opcional); preenchido precisa ter 14 dígitos. */
export function isCnpjComplete(value: string): boolean {
  const n = value.replace(/\D/g, '').length;
  return n === 0 || n === 14;
}

export const COMMON_INSTITUTIONS = [
  'XP Investimentos', 'BTG Pactual', 'Nubank', 'Inter', 'Itaú', 'Bradesco',
  'C6 Bank', 'Mercado Pago', 'Banco do Brasil', 'Caixa', 'Santander', 'Rico', 'Clear', 'Genial',
];

/** Une instituições do usuário (primeiro) com as comuns, sem duplicar ignorando caixa/acentos. */
export function buildInstitutionSuggestions(userInstitutions: (string | null | undefined)[]): string[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...userInstitutions, ...COMMON_INSTITUTIONS]) {
    if (!s || !s.trim()) continue;
    const k = norm(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}
