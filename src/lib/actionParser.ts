// Robust JSON-based action parser. No regex parsing of action payloads.
import { z } from 'zod';
import { normalizeAmount, normalizeCategory } from './transactionNormalization';
import { normalizeToLocalDate } from './dateUtils';

// ── Discriminated union of action payloads ──────────────────────────
const AddTransactionSchema = z.object({
  type: z.literal('add_transaction'),
  payload: z.object({
    type: z.enum(['income', 'expense', 'investment']),
    amount: z.union([z.number(), z.string()]),
    category: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    investment_operation: z.enum(['deposit', 'withdraw', 'yield', 'loss']).optional(),
    investment_type: z.string().optional(),
    institution: z.string().optional(),
  }),
});

const DeleteTransactionSchema = z.object({
  type: z.literal('delete_transaction'),
  payload: z.object({ id: z.string() }),
});

const DeleteAllSchema = z.object({
  type: z.literal('delete_all_transactions'),
  payload: z.object({ filter: z.enum(['all', 'income', 'expense']).optional() }).optional(),
});

const WebSearchSchema = z.object({
  type: z.literal('web_search'),
  payload: z.object({ query: z.string().min(1) }),
});

const RequestClarificationSchema = z.object({
  type: z.literal('request_clarification'),
  payload: z.object({
    intent: z.string(),
    partial: z.record(z.any()).optional(),
    missing_field: z.string().optional(),
  }),
});

const ActionSchema = z.discriminatedUnion('type', [
  AddTransactionSchema,
  DeleteTransactionSchema,
  DeleteAllSchema,
  WebSearchSchema,
  RequestClarificationSchema,
]);

const AIResponseSchema = z.object({
  message: z.string(),
  // Accept both `actions` (array) and legacy `action` (single object)
  actions: z.array(z.any()).optional(),
  action: z.any().optional(),
});

// ── Public types (normalized) ───────────────────────────────────────
export type Action =
  | {
      type: 'add_transaction';
      payload: {
        type: 'income' | 'expense' | 'investment';
        amount: number;
        category: string;
        description: string;
        date: string;
        investment_operation?: 'deposit' | 'withdraw' | 'yield' | 'loss';
        investment_type?: string;
        institution?: string;
      };
    }
  | { type: 'delete_transaction'; payload: { id: string } }
  | { type: 'delete_all_transactions'; payload: { filter: 'all' | 'income' | 'expense' } }
  | { type: 'web_search'; payload: { query: string } }
  | { type: 'request_clarification'; payload: { intent: string; partial?: Record<string, unknown>; missing_field?: string } };

export interface ParsedAIResponse {
  message: string;
  actions: Action[];
  raw?: unknown;
}

// ── Helpers ─────────────────────────────────────────────────────────
function tryParseJSON(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    // Try slicing to outer braces
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAction(raw: unknown): Action | null {
  // Support legacy shape: { action: 'add_transaction', amount, ... }
  let candidate: unknown = raw;
  if (raw && typeof raw === 'object' && 'action' in (raw as Record<string, unknown>) && !('type' in (raw as Record<string, unknown>))) {
    const r = raw as Record<string, unknown>;
    const actName = r.action as string;
    const { action: _drop, ...rest } = r;
    candidate = { type: actName, payload: rest };
  }

  const parsed = ActionSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const a = parsed.data;

  switch (a.type) {
    case 'add_transaction': {
      const amount = normalizeAmount(a.payload.amount);
      if (amount === null || amount <= 0) return null;
      const description = (a.payload.description || '').trim();
      const date = normalizeToLocalDate(a.payload.date);
      if (a.payload.type === 'investment') {
        const op = a.payload.investment_operation;
        if (!op) return null;
        const invType = a.payload.investment_type || 'outros';
        return {
          type: 'add_transaction',
          payload: {
            type: 'investment',
            amount,
            category: 'investimento',
            description,
            date,
            investment_operation: op,
            investment_type: invType,
            institution: a.payload.institution,
          },
        };
      }
      const txType = a.payload.type as 'income' | 'expense';
      const category = normalizeCategory(a.payload.category, txType, description);
      return { type: 'add_transaction', payload: { type: txType, amount, category, description, date } };
    }
    case 'delete_transaction':
      return { type: 'delete_transaction', payload: { id: a.payload.id } };
    case 'delete_all_transactions':
      return { type: 'delete_all_transactions', payload: { filter: a.payload?.filter || 'all' } };
    case 'web_search':
      return { type: 'web_search', payload: { query: a.payload.query.trim() } };
    case 'request_clarification':
      return { type: 'request_clarification', payload: { intent: a.payload.intent || 'unknown', partial: a.payload.partial, missing_field: a.payload.missing_field } };
  }
}

// ── Main parser ─────────────────────────────────────────────────────
export function parseAIResponse(content: string): ParsedAIResponse {
  const raw = tryParseJSON(content);

  if (!raw || typeof raw !== 'object') {
    return { message: content.trim(), actions: [] };
  }

  const validated = AIResponseSchema.safeParse(raw);
  if (!validated.success) {
    // Best-effort: if there's a top-level `message` string, use it
    const r = raw as Record<string, unknown>;
    const msg = typeof r.message === 'string' ? r.message : content;
    return { message: msg, actions: [], raw };
  }

  const data = validated.data;
  const rawActions: unknown[] = [];
  if (Array.isArray(data.actions)) rawActions.push(...data.actions);
  if (data.action) rawActions.push(data.action);

  const actions: Action[] = [];
  for (const ra of rawActions) {
    const norm = normalizeAction(ra);
    if (norm) actions.push(norm);
  }

  return { message: data.message, actions, raw };
}
