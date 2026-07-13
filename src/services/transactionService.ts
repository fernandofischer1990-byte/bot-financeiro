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

export async function fetchUserTransactions(userId: string): Promise<{ data: Transaction[] | null; error: string | null }> {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { data: null, error: 'userId inválido' };
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select("id,type,amount,category,description,transaction_date,source,created_at,updated_at,user_id,financial_scope,investment_operation,investment_type,institution,tax_id,irpf_category,receipt_url")
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(1000);

    if (error) {
      return { data: null, error: error.message || 'Erro ao carregar transações' };
    }

    if (data === null || data === undefined) {
      return { data: null, error: 'Resposta inesperada do servidor' };
    }

    return { data: data.map(castTransaction), error: null };
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
  const { error } = await supabase
    .from('transactions')
    .update({
      type: updates.type,
      amount: updates.amount,
      category: updates.category,
      description: updates.description,
      transaction_date: updates.transaction_date,
      updated_at: new Date().toISOString(),
    })
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
