import { read, utils } from 'xlsx';
import { InvestmentInput, InvestmentType } from '@/types/investment';
import { normalizeToLocalDate } from '@/lib/dateUtils';

/**
 * Normalize a column header for matching.
 * NFD strip + lowercase + underscore + trim.
 */
export function normalizeColumnName(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Map normalized header → internal field
const HEADER_MAP: Record<string, keyof InvestmentInput> = {
  investimento: 'investment_name',
  nome: 'investment_name',
  ativo: 'investment_name',
  papel: 'investment_name',
  produto: 'investment_name',
  tipo_investimento: 'investment_type',
  tipo: 'investment_type',
  investidora: 'institution',
  instituicao: 'institution',
  banco: 'institution',
  corretora: 'institution',
  valor: 'initial_amount',
  valor_inicial: 'initial_amount',
  aporte: 'initial_amount',
  valor_aplicado: 'initial_amount',
  saldo: 'current_balance',
  saldo_atual: 'current_balance',
  valor_atual: 'current_balance',
  posicao: 'current_balance',
  inicio: 'start_date',
  data_inicio: 'start_date',
  data_aplicacao: 'start_date',
  fim: 'end_date',
  vencimento: 'end_date',
  data_vencimento: 'end_date',
  prazo_dias: 'term_days',
  prazo_meses: 'term_months',
  prazo_anos: 'term_years',
};

function parseNumberLike(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const str = String(v).trim();
  // strip non-numeric trailing like "2176dias", "71meses"
  const match = str.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
  // If original had thousands separator try parseFloat differently
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[R$\s]/g, '');
  // BR style 1.234,56 → 1234.56 ; US 1,234.56
  let normalized = s;
  if (/,\d{1,2}$/.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseDateLike(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return normalizeToLocalDate(s);
}

/** Infer investment_type from name. */
export function inferInvestmentType(name: string): InvestmentType {
  const n = name.toLowerCase();
  if (/\bcoe\b/i.test(name)) return 'coe';
  if (/\b(cdb|rdb|lci|lca|letra de credito|letra de cr[eé]dito)\b/.test(n)) return 'renda_fixa';
  if (/\btesouro\b|selic|ipca|prefixado/.test(n)) return 'tesouro_direto';
  if (/\bfii\b|fundo imobili[áa]rio|hglg|knri|mxrf|visc/.test(n)) return 'fii';
  if (/\betf\b|bova11|ivvb11|smal11/.test(n)) return 'etf';
  if (/bitcoin|btc\b|cripto|ethereum|eth\b|usdt/.test(n)) return 'criptomoedas';
  if (/previd[êe]ncia|pgbl|vgbl/.test(n)) return 'previdencia';
  if (/poupan[çc]a/.test(n)) return 'poupanca';
  if (/[a-z]{4}\d{1,2}\b/.test(n)) return 'acoes'; // PETR4, ITSA4
  if (/a[çc][õo]es|ordin[áa]ria|preferencial/.test(n)) return 'acoes';
  if (/fundo\b|multimercado|renda fixa/.test(n)) return 'fundo';
  return 'outros';
}

export interface ParsedInvestmentRow {
  input: InvestmentInput;
  rawRow: Record<string, unknown>;
  unknownColumns: string[];
  rowIndex: number;
}

/**
 * Parse a single workbook sheet into investment rows.
 * Returns ALL rows; unknown columns are preserved in metadata.
 */
export function parseInvestmentSheet(rows: Record<string, unknown>[], fileName: string): ParsedInvestmentRow[] {
  return rows.map((rawRow, idx) => {
    const mapped: Partial<InvestmentInput> = {};
    const metadata: Record<string, unknown> = {};
    const unknownColumns: string[] = [];

    for (const [origKey, value] of Object.entries(rawRow)) {
      if (value === null || value === undefined || value === '') continue;
      const norm = normalizeColumnName(origKey);
      const field = HEADER_MAP[norm];

      if (!field) {
        metadata[norm || origKey] = value instanceof Date ? value.toISOString() : value;
        unknownColumns.push(origKey);
        continue;
      }

      switch (field) {
        case 'investment_name':
        case 'institution':
        case 'investment_type':
          (mapped as any)[field] = String(value).trim();
          break;
        case 'initial_amount':
        case 'current_balance': {
          const n = parseAmount(value);
          if (n !== null) (mapped as any)[field] = n;
          break;
        }
        case 'start_date':
        case 'end_date': {
          const d = parseDateLike(value);
          if (d) (mapped as any)[field] = d;
          break;
        }
        case 'term_days':
        case 'term_months':
        case 'term_years': {
          const n = parseNumberLike(value);
          if (n !== null) (mapped as any)[field] = Math.round(n);
          break;
        }
      }
    }

    const name = (mapped.investment_name || '').trim() || `Investimento ${idx + 1}`;
    const investmentType =
      (mapped.investment_type as string) || inferInvestmentType(name);

    const input: InvestmentInput = {
      investment_name: name,
      investment_type: investmentType,
      institution: mapped.institution ?? null,
      initial_amount: mapped.initial_amount ?? mapped.current_balance ?? 0,
      current_balance: mapped.current_balance ?? mapped.initial_amount ?? 0,
      start_date: mapped.start_date ?? null,
      end_date: mapped.end_date ?? null,
      term_days: mapped.term_days ?? null,
      term_months: mapped.term_months ?? null,
      term_years: mapped.term_years ?? null,
      metadata,
      imported_from: 'xlsx',
      source_file_name: fileName,
      imported_at: new Date().toISOString(),
    };

    return { input, rawRow, unknownColumns, rowIndex: idx };
  });
}

/** Parse XLSX/XLS/CSV file. Returns rows from the first non-empty sheet. */
export async function parseInvestmentSpreadsheet(file: File): Promise<{
  rows: ParsedInvestmentRow[];
  sheetName: string;
  totalRows: number;
}> {
  const buf = await file.arrayBuffer();
  const wb = read(buf, { cellDates: true });
  let chosenSheet = wb.SheetNames[0];
  // pick sheet with most rows
  let maxRows = 0;
  for (const sn of wb.SheetNames) {
    const json = utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn], { defval: null });
    if (json.length > maxRows) {
      maxRows = json.length;
      chosenSheet = sn;
    }
  }
  const data = utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[chosenSheet], { defval: null });
  const parsed = parseInvestmentSheet(data, file.name)
    .filter(r => r.input.investment_name && (r.input.current_balance > 0 || r.input.initial_amount > 0));
  return { rows: parsed, sheetName: chosenSheet, totalRows: data.length };
}
