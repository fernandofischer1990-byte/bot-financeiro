import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  /** Primeiro dia do mês de referência (YYYY-MM-01). */
  month: string;
  amount: number;
}

export interface BudgetInput {
  category: string;
  /** Chave de mês YYYY-MM. */
  monthKey: string;
  amount: number;
}

const monthKeyToDate = (monthKey: string) => `${monthKey}-01`;

export async function fetchBudgets(userId: string, monthKey?: string) {
  let query = supabase.from('budgets').select('*').eq('user_id', userId);
  if (monthKey) query = query.eq('month', monthKeyToDate(monthKey));

  const { data, error } = await query.order('category');
  if (error) {
    logger.error('[Budgets] fetch failed:', error);
    return { data: null, error: error.message };
  }
  return { data: (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) })) as Budget[], error: null };
}

/** Cria ou atualiza o orçamento de uma categoria em um mês (um por categoria/mês). */
export async function upsertBudget(userId: string, input: BudgetInput) {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, category: input.category, month: monthKeyToDate(input.monthKey), amount: input.amount },
      { onConflict: 'user_id,category,month' }
    )
    .select()
    .single();

  if (error) {
    logger.error('[Budgets] upsert failed:', error);
    return { data: null, error: error.message };
  }
  return { data: { ...data, amount: Number(data.amount) } as Budget, error: null };
}

export async function deleteBudget(userId: string, id: string) {
  const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', userId);
  if (error) {
    logger.error('[Budgets] delete failed:', error);
    return { error: error.message };
  }
  return { error: null };
}
