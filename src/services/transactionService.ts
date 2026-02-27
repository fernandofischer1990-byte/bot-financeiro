import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionInput } from '@/contexts/TransactionsContext';
import { getLocalISODate } from '@/lib/dateUtils';

const FETCH_TIMEOUT_MS = 30000;

function castTransaction(tx: Record<string, unknown>): Transaction {
  return {
    ...tx,
    type: tx.type as 'income' | 'expense',
    source: tx.source as 'manual' | 'chat' | 'upload',
  } as Transaction;
}

export async function fetchUserTransactions(userId: string): Promise<{ data: Transaction[]; error: string | null }> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tempo limite excedido')), FETCH_TIMEOUT_MS)
    );

    const fetchPromise = supabase
      .from('transactions')
      .select('id,type,amount,category,description,transaction_date,source,created_at,updated_at,user_id')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(1000);

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      return { data: [], error: error.message || 'Erro ao carregar transações' };
    }

    return { data: (data || []).map(castTransaction), error: null };
  } catch (err) {
    const msg = err instanceof Error && err.message === 'Tempo limite excedido'
      ? 'Tempo limite excedido. Verifique sua conexão.'
      : 'Falha de rede. Tente novamente.';
    return { data: [], error: msg };
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
