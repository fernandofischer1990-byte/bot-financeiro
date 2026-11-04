import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionInput, InvestmentOperation, FinancialScope } from '@/contexts/TransactionsContext';
import { getLocalISODate } from '@/lib/dateUtils';

function castTransaction(tx: Record<string, unknown>): Transaction {
  return {
    ...tx,
    type: tx.type as 'income' | 'expense' | 'investment',
    source: tx.source as 'manual' | 'chat' | 'upload',
    financial_scope: ((tx.financial_scope as FinancialScope | undefined) ??
      (tx.type === 'investment' ? 'investment' : 'operational')),
    investment_operation: (tx.investment_operation as InvestmentOperation | null | undefined) ?? null,
    investment_type: (tx.investment_type as string | null | undefined) ?? null,
    institution: (tx.institution as string | null | undefined) ?? null,
    taxId: (tx.tax_id as string | null | undefined) ?? undefined,
    irpfCategory: (tx.irpf_category as string | null | undefined) ?? undefined,
    receiptUrl: (tx.receipt_url as string | null | undefined) ?? undefined,
  } as Transaction;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // teto de segurança: 50.000 transações

const TX_COLUMNS =
  "id,type,amount,category,description,transaction_date,source,created_at,updated_at,user_id,financial_scope,investment_operation,investment_type,institution,tax_id,irpf_category,receipt_url";

/**
 * Carrega TODAS as transações do usuário paginando no servidor (C1).
 * Evita o corte silencioso em 1.000 registros que distorcia as métricas.
 */
export async function fetchUserTransactions(userId: string): Promise<{ data: Transaction[] | null; error: string | null }> {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { data: null, error: 'userId inválido' };
  }

  try {
    const all: Transaction[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_COLUMNS)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return { data: null, error: error.message || 'Erro ao carregar transações' };
      }
      if (data === null || data === undefined) {
        return { data: null, error: 'Resposta inesperada do servidor' };
      }

      all.push(...data.map(castTransaction));
      if (data.length < PAGE_SIZE) break;
    }

    return { data: all, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha de rede. Tente novamente.';
    return { data: null, error: msg };
  }
}


export async function insertTransaction(
  userId: string,
  input: TransactionInput
): Promise<{ data: Transaction | null; error: string | null }> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: input.type,
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      transaction_date: input.transaction_date || getLocalISODate(),
      source: input.source || 'manual',
      investment_operation: input.type === 'investment' ? input.investment_operation ?? null : null,
      investment_type: input.type === 'investment' ? input.investment_type ?? null : null,
      institution: input.type === 'investment' ? input.institution ?? null : null,
      tax_id: input.taxId ?? null,
      irpf_category: input.irpfCategory ?? null,
      receipt_url: input.receiptUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: castTransaction(data as Record<string, unknown>), error: null };
}

export async function insertMultipleTransactions(
  userId: string,
  inputs: TransactionInput[]
): Promise<{ data: Transaction[]; error: string | null }> {
  if (inputs.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('transactions')
    .insert(
      inputs.map(input => ({
        user_id: userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description || null,
        transaction_date: input.transaction_date || getLocalISODate(),
        source: input.source || 'upload',
        investment_operation: input.type === 'investment' ? input.investment_operation ?? null : null,
        investment_type: input.type === 'investment' ? input.investment_type ?? null : null,
        institution: input.type === 'investment' ? input.institution ?? null : null,
        tax_id: input.taxId ?? null,
        irpf_category: input.irpfCategory ?? null,
        receipt_url: input.receiptUrl ?? null,
      }))
    )
    .select();

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data || []).map(tx => castTransaction(tx as Record<string, unknown>)), error: null };
}

export async function updateTransactionById(
  userId: string,
  id: string,
  updates: Partial<Transaction>
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    type: updates.type,
    amount: updates.amount,
    category: updates.category,
    description: updates.description,
    transaction_date: updates.transaction_date,
    updated_at: new Date().toISOString(),
  };
  if ('taxId' in updates) payload.tax_id = updates.taxId ?? null;
  if ('irpfCategory' in updates) payload.irpf_category = updates.irpfCategory ?? null;
  if ('receiptUrl' in updates) payload.receipt_url = updates.receiptUrl ?? null;

  const { error } = await supabase
    .from('transactions')
    .update(payload as never)
    .eq('id', id)
    .eq('user_id', userId);

  return { error: error?.message || null };
}

export async function deleteTransactionById(
  userId: string,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return { error: error?.message || null };
}

export async function deleteUserTransactions(
  userId: string,
  filter: 'all' | 'income' | 'expense' = 'all'
): Promise<{ error: string | null }> {
  let query = supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId);

  if (filter !== 'all') {
    query = query.eq('type', filter);
  }

  const { error } = await query;
  return { error: error?.message || null };
}

export interface TransactionPageFilters {
  type?: 'income' | 'expense' | 'investment';
  category?: string;
  startDate?: string; // yyyy-MM-dd
  endDate?: string;
  search?: string;
}

export interface TransactionCursor {
  date: string;
  id: string;
}

export const TX_PAGE_SIZE = 50;

/** Sanitiza o texto de busca para uso seguro em filtros PostgREST (or/ilike). */
export function sanitizeSearch(q: string): string {
  return q.replace(/[%_,()*\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

/**
 * Página de transações por cursor (keyset em transaction_date desc, id desc),
 * com filtros aplicados no servidor sobre todo o histórico.
 */
export async function fetchTransactionsPage(
  userId: string,
  opts: { cursor?: TransactionCursor | null; limit?: number; filters?: TransactionPageFilters } = {}
): Promise<{ data: Transaction[]; nextCursor: TransactionCursor | null; error: string | null }> {
  if (!userId) return { data: [], nextCursor: null, error: 'userId inválido' };
  const limit = Math.min(Math.max(opts.limit ?? TX_PAGE_SIZE, 1), 200);
  const f = opts.filters ?? {};

  let query = supabase
    .from('transactions')
    .select(TX_COLUMNS)
    .eq('user_id', userId);

  if (f.type) query = query.eq('type', f.type);
  if (f.category) query = query.eq('category', f.category);
  if (f.startDate) query = query.gte('transaction_date', f.startDate);
  if (f.endDate) query = query.lte('transaction_date', f.endDate);
  const q = f.search ? sanitizeSearch(f.search) : '';
  if (q) query = query.or(`description.ilike.*${q}*,category.ilike.*${q}*,institution.ilike.*${q}*`);
  if (opts.cursor) {
    const { date, id } = opts.cursor;
    query = query.or(`transaction_date.lt.${date},and(transaction_date.eq.${date},id.lt.${id})`);
  }

  const { data, error } = await query
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (error) return { data: [], nextCursor: null, error: error.message || 'Erro ao carregar transações' };
  const rows = (data ?? []).map(r => castTransaction(r as Record<string, unknown>));
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    data: page,
    nextCursor: hasMore && last ? { date: last.transaction_date, id: last.id } : null,
    error: null,
  };
}

/** Busca todas as transações de um intervalo (ou todo o histórico), em blocos de 200 por cursor. */
export async function fetchTransactionsInRange(
  userId: string,
  filters: TransactionPageFilters = {}
): Promise<{ data: Transaction[]; error: string | null }> {
  const all: Transaction[] = [];
  let cursor: TransactionCursor | null = null;
  for (let i = 0; i < 500; i++) {
    const r = await fetchTransactionsPage(userId, { cursor, limit: 200, filters });
    if (r.error) return { data: [], error: r.error };
    all.push(...r.data);
    if (!r.nextCursor) break;
    cursor = r.nextCursor;
  }
  return { data: all, error: null };
}
