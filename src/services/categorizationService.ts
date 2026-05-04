import { supabase } from '@/integrations/supabase/client';

export interface CategorizeItem {
  index: number;
  description: string;
  type: 'income' | 'expense';
}

export interface CategorizeResult {
  index: number;
  category: string;
}

const BATCH_SIZE = 50;

/**
 * Classify a list of transactions using AI, in batches.
 * Returns a Map<index, category>. Indices that failed are simply omitted.
 */
export async function categorizeWithAI(
  items: CategorizeItem[]
): Promise<{ map: Map<number, string>; error: string | null }> {
  const map = new Map<number, string>();
  if (items.length === 0) return { map, error: null };

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await supabase.functions.invoke('categorize-transactions', {
        body: { items: batch },
      });
      if (error) {
        console.error('[Categorization] batch error:', error);
        // Continue other batches but report the first error
        return { map, error: error.message || 'Erro ao categorizar com IA' };
      }
      const results: CategorizeResult[] = data?.results || [];
      for (const r of results) {
        if (r && typeof r.index === 'number' && typeof r.category === 'string') {
          map.set(r.index, r.category);
        }
      }
    } catch (e) {
      console.error('[Categorization] invoke failed:', e);
      return { map, error: e instanceof Error ? e.message : 'Erro inesperado' };
    }
  }

  return { map, error: null };
}
