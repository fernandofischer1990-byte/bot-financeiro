import { z } from 'zod';
import type { Transaction } from '@/types/finance';

/**
 * Contrato mínimo de uma linha de `transactions` recebida via Realtime.
 * Payloads que não passam aqui são descartados — nunca entram no estado.
 */
const realtimeTransactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.enum(['income', 'expense', 'investment']),
  amount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  category: z.string(),
  description: z.string().nullable().optional(),
  transaction_date: z.string(),
  source: z.string().default('manual'),
  created_at: z.string(),
  updated_at: z.string().optional(),
  financial_scope: z.string().nullable().optional(),
  investment_operation: z.string().nullable().optional(),
  investment_type: z.string().nullable().optional(),
  institution: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  irpf_category: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
});

/** Valida e normaliza um payload de Realtime. Retorna `null` quando inválido. */
export function parseRealtimeTransaction(row: unknown): Transaction | null {
  const parsed = realtimeTransactionSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  const { tax_id, irpf_category, receipt_url, ...rest } = r;
  return {
    ...rest,
    financial_scope: (r.financial_scope ?? (r.type === 'investment' ? 'investment' : 'operational')) as Transaction['financial_scope'],
    investment_operation: (r.investment_operation ?? null) as Transaction['investment_operation'],
    investment_type: r.investment_type ?? null,
    institution: r.institution ?? null,
    taxId: tax_id ?? undefined,
    irpfCategory: irpf_category ?? undefined,
    receiptUrl: receipt_url ?? undefined,
  } as Transaction;
}

/** Extrai o id de um payload de DELETE do Realtime. */
export function parseRealtimeDeletedId(row: unknown): string | null {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(row);
  return parsed.success ? parsed.data.id : null;
}
