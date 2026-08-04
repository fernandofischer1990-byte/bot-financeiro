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

export interface ActivityLogCursor {
  created_at: string;
  id: string;
}

export interface ActivityLogFilters {
  entity?: ActivityEntity | 'all';
  action?: ActivityAction | 'all';
  source?: ActivitySource | 'all';
  days?: number | 'all';
  /** Busca textual (label / entity_id / snapshots) */
  search?: string;
  /** Paginação cursor-based: retorna registros anteriores ao cursor */
  cursor?: ActivityLogCursor | null;
  /** Tamanho da página */
  pageSize?: number;
}

export interface ActivityLogPage {
  data: ActivityLogEntry[];
  nextCursor: ActivityLogCursor | null;
  hasMore: boolean;
  error: string | null;
}

const DEFAULT_PAGE_SIZE = 50;

function escapeForOr(value: string): string {
  // Vírgulas/parênteses quebram a sintaxe do filtro `or` do PostgREST
  return value.replace(/[(),]/g, ' ').trim();
}

export async function fetchActivityLog(
  userId: string,
  filters: ActivityLogFilters = {}
): Promise<ActivityLogPage> {
  if (!userId) return { data: [], nextCursor: null, hasMore: false, error: 'userId inválido' };

  const pageSize = Math.min(Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1), 200);

  try {
    let query = supabase
      .from('activity_log')
      .select('id,user_id,action,entity,entity_id,source,label,before,after,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);

    if (filters.entity && filters.entity !== 'all') query = query.eq('entity', filters.entity);
    if (filters.action && filters.action !== 'all') query = query.eq('action', filters.action);
    if (filters.source && filters.source !== 'all') query = query.eq('source', filters.source);
    if (filters.days && filters.days !== 'all') {
      const since = new Date();
      since.setDate(since.getDate() - filters.days);
      query = query.gte('created_at', since.toISOString());
    }

    const term = escapeForOr(filters.search ?? '');
    if (term) {
      query = query.or(
        [
          `label.ilike.*${term}*`,
          `entity_id.ilike.*${term}*`,
          `before::text.ilike.*${term}*`,
          `after::text.ilike.*${term}*`,
        ].join(',')
      );
    }

    if (filters.cursor) {
      const { created_at, id } = filters.cursor;
      query = query.or(
        `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`
      );
    }

    const { data, error } = await query;
    if (error) return { data: [], nextCursor: null, hasMore: false, error: error.message };

    const rows = (data ?? []) as unknown as ActivityLogEntry[];
    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const last = page[page.length - 1];
    return {
      data: page,
      hasMore,
      nextCursor: hasMore && last ? { created_at: last.created_at, id: last.id } : null,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha de rede. Tente novamente.';
    return { data: [], nextCursor: null, hasMore: false, error: msg };
  }
}


export async function clearActivityLog(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('activity_log').delete().eq('user_id', userId);
  return { error: error?.message ?? null };
}
