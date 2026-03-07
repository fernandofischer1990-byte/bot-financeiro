import { supabase } from '@/integrations/supabase/client';

export interface ImportHistoryRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_format: string;
  total_records: number;
  imported_records: number;
  duplicate_records: number;
  skipped_records: number;
  created_at: string;
}

export async function saveImportHistory(
  userId: string,
  record: {
    file_name: string;
    file_format: string;
    total_records: number;
    imported_records: number;
    duplicate_records: number;
    skipped_records: number;
  }
): Promise<{ data: ImportHistoryRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from('import_history')
    .insert({ ...record, user_id: userId })
    .select()
    .single();

  if (error) {
    console.error('[ImportService] saveImportHistory error:', error);
    return { data: null, error: error.message };
  }

  return { data: data as unknown as ImportHistoryRecord, error: null };
}

export async function fetchImportHistory(
  userId: string
): Promise<{ data: ImportHistoryRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from('import_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[ImportService] fetchImportHistory error:', error);
    return { data: [], error: error.message };
  }

  return { data: (data || []) as unknown as ImportHistoryRecord[], error: null };
}
