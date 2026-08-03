import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ActivityAction = 'create' | 'update' | 'delete' | 'import' | 'bulk_delete';
export type ActivityEntity = 'transaction' | 'investment';
export type ActivitySource = 'manual' | 'chat' | 'upload' | 'mcp' | 'system';

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entity_id: string | null;
  source: ActivitySource;
  label: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLogInput {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  source?: ActivitySource;
  label?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Registro de auditoria "best-effort": uma falha de log NUNCA deve
 * interromper ou reverter a operação financeira do usuário.
 */
export async function logActivity(userId: string, entry: ActivityLogInput): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from('activity_log').insert([{
      user_id: userId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      source: entry.source ?? 'manual',
      label: entry.label ?? null,
      before: (entry.before ?? null) as Json,
      after: (entry.after ?? null) as Json,
    }]);
  } catch (err) {
    console.warn('[Activity] Falha ao registrar histórico:', entry.action, entry.entity, err);
  }
}

export interface ActivityLogFilters {
  entity?: ActivityEntity | 'all';
  action?: ActivityAction | 'all';
  days?: number | 'all';
  limit?: number;
}

export async function fetchActivityLog(
  userId: string,
  filters: ActivityLogFilters = {}
): Promise<{ data: ActivityLogEntry[] | null; error: string | null }> {
  if (!userId) return { data: null, error: 'userId inválido' };

  try {
    let query = supabase
      .from('activity_log')
      .select('id,user_id,action,entity,entity_id,source,label,before,after,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 300);

    if (filters.entity && filters.entity !== 'all') query = query.eq('entity', filters.entity);
    if (filters.action && filters.action !== 'all') query = query.eq('action', filters.action);
    if (filters.days && filters.days !== 'all') {
      const since = new Date();
      since.setDate(since.getDate() - filters.days);
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as unknown as ActivityLogEntry[], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha de rede. Tente novamente.';
    return { data: null, error: msg };
  }
}

export async function clearActivityLog(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('activity_log').delete().eq('user_id', userId);
  return { error: error?.message ?? null };
}
