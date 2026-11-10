// Estimativa do valor atual de um investimento a partir do indexador (CDI, Selic, IPCA+, prefixado).
import type { Investment } from '@/types/investment';

export type IndexerKind = 'none' | 'cdi' | 'selic' | 'ipca' | 'pre';

export interface ReferenceRates {
  /** % ao ano */
  cdi: number;
  selic: number;
  /** IPCA acumulado 12 meses, % */
  ipca: number;
  fetchedFromBcb?: boolean;
}

/** Usado só se o Banco Central não responder. */
export const FALLBACK_RATES: ReferenceRates = { cdi: 13.65, selic: 13.75, ipca: 4.58, fetchedFromBcb: false };

export const INDEXER_OPTIONS: { value: IndexerKind; label: string; rateLabel: string; placeholder: string }[] = [
  { value: 'none', label: 'Sem indexador', rateLabel: '', placeholder: '' },
  { value: 'cdi', label: '% do CDI', rateLabel: '% do CDI', placeholder: '110' },
  { value: 'ipca', label: 'IPCA +', rateLabel: 'Taxa acima do IPCA (% a.a.)', placeholder: '5' },
  { value: 'selic', label: 'Selic +', rateLabel: 'Taxa acima da Selic (% a.a.)', placeholder: '0' },
  { value: 'pre', label: 'Prefixado', rateLabel: 'Taxa (% a.a.)', placeholder: '12' },
];

export function getIndexer(meta: Record<string, unknown> | null | undefined): { kind: IndexerKind; rate: number } {
  const kind = (meta?.indexer as IndexerKind) ?? 'none';
  const rate = Number(meta?.indexer_rate);
  if (!['cdi', 'selic', 'ipca', 'pre'].includes(kind)) return { kind: 'none', rate: 0 };
  return { kind, rate: Number.isFinite(rate) ? rate : 0 };
}

/** Taxa efetiva anual em %. */
export function effectiveAnnualRate(kind: IndexerKind, rate: number, ref: ReferenceRates): number | null {
  switch (kind) {
    case 'cdi': return ref.cdi * (rate / 100);
    case 'selic': return ref.selic + rate;
    case 'ipca': return ((1 + ref.ipca / 100) * (1 + rate / 100) - 1) * 100;
    case 'pre': return rate;
    default: return null;
  }
}

function toUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Valor estimado em `today` (YYYY-MM-DD). Rende até hoje ou até o vencimento, o que vier antes. */
export function estimateCurrentValue(
  inv: Pick<Investment, 'initial_amount' | 'start_date' | 'end_date' | 'metadata'>,
  ref: ReferenceRates,
  today: string,
): number {
  const initial = Number(inv.initial_amount) || 0;
  const { kind, rate } = getIndexer(inv.metadata);
  const annual = effectiveAnnualRate(kind, rate, ref);
  if (annual === null || !inv.start_date) return initial;
  const start = toUtc(inv.start_date);
  const now = toUtc(today);
  const end = inv.end_date ? toUtc(inv.end_date) : null;
  if (start === null || now === null) return initial;
  const stop = end !== null && end < now ? end : now;
  const days = (stop - start) / 86_400_000;
  if (days <= 0) return initial;
  return Math.round(initial * Math.pow(1 + annual / 100, days / 365) * 100) / 100;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function lastValue(series: number): Promise<number | null> {
  const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`);
  if (!res.ok) return null;
  const json = (await res.json()) as { valor: string }[];
  const n = Number(json?.[0]?.valor);
  return Number.isFinite(n) ? n : null;
}

/** CDI (4389), Selic (1178) e IPCA 12 meses (13522) do Banco Central. */
export async function fetchReferenceRates(): Promise<ReferenceRates> {
  try {
    const [cdi, selic, ipca] = await Promise.all([lastValue(4389), lastValue(1178), lastValue(13522)]);
    if (cdi === null || selic === null || ipca === null) return FALLBACK_RATES;
    return { cdi, selic, ipca, fetchedFromBcb: true };
  } catch {
    return FALLBACK_RATES;
  }
}
