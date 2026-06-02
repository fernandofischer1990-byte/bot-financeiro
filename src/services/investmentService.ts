import { supabase } from '@/integrations/supabase/client';
import { Investment, InvestmentInput } from '@/types/investment';

function castInvestment(row: Record<string, unknown>): Investment {
  return {
    ...row,
    initial_amount: Number(row.initial_amount ?? 0),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  } as Investment;
}

export async function fetchUserInvestments(userId: string): Promise<{ data: Investment[] | null; error: string | null }> {
  if (!userId) return { data: null, error: 'userId inválido' };
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)
    .order('initial_amount', { ascending: false })
    .limit(1000);
  if (error) return { data: null, error: error.message };
  return { data: (data || []).map(r => castInvestment(r as Record<string, unknown>)), error: null };
}

export async function insertInvestment(userId: string, input: InvestmentInput): Promise<{ data: Investment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('investments')
    .insert({
      user_id: userId,
      investment_name: input.investment_name,
      investment_type: input.investment_type ?? 'outros',
      institution: input.institution ?? null,
      initial_amount: input.initial_amount,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      term_days: input.term_days ?? null,
      term_months: input.term_months ?? null,
      term_years: input.term_years ?? null,
      metadata: (input.metadata as never) ?? {},
      imported_from: input.imported_from ?? 'manual',
      source_file_name: input.source_file_name ?? null,
      imported_at: input.imported_at ?? null,
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: castInvestment(data as Record<string, unknown>), error: null };
}

export async function insertMultipleInvestments(userId: string, inputs: InvestmentInput[]): Promise<{ data: Investment[]; error: string | null }> {
  if (inputs.length === 0) return { data: [], error: null };
  const rows = inputs.map(input => ({
    user_id: userId,
    investment_name: input.investment_name,
    investment_type: input.investment_type ?? 'outros',
    institution: input.institution ?? null,
    initial_amount: input.initial_amount,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    term_days: input.term_days ?? null,
    term_months: input.term_months ?? null,
    term_years: input.term_years ?? null,
    metadata: (input.metadata as never) ?? {},
    imported_from: input.imported_from ?? 'xlsx',
    source_file_name: input.source_file_name ?? null,
    imported_at: input.imported_at ?? new Date().toISOString(),
  }));
  const { data, error } = await supabase.from('investments').insert(rows).select();
  if (error) return { data: [], error: error.message };
  return { data: (data || []).map(r => castInvestment(r as Record<string, unknown>)), error: null };
}

export async function updateInvestmentById(userId: string, id: string, updates: Partial<InvestmentInput>): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = { ...updates };
  if ('metadata' in payload) payload.metadata = (payload.metadata ?? {}) as never;
  payload.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from('investments')
    .update(payload as never)
    .eq('id', id)
    .eq('user_id', userId);
  return { error: error?.message || null };
}

export async function deleteInvestmentById(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('investments').delete().eq('id', id).eq('user_id', userId);
  return { error: error?.message || null };
}

export async function deleteAllInvestments(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('investments').delete().eq('user_id', userId);
  return { error: error?.message || null };
}
