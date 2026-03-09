import { supabase } from '@/integrations/supabase/client';

export interface CategoryMapping {
  id: string;
  category: string;
  description_pattern: string;
  usage_count: number;
}

export function normalizePattern(description: string): string {
  if (!description) return '';
  return description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .substring(0, 50);
}

export async function getUserCategoryMappings(userId: string): Promise<CategoryMapping[]> {
  const { data, error } = await supabase
    .from('category_mappings')
    .select('*')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false });
    
  if (error) {
    console.error('Error fetching category mappings:', error);
    return [];
  }
  
  return data || [];
}

export function findLearnedCategory(description: string, mappings: CategoryMapping[]): string | null {
  const normalizedDesc = normalizePattern(description);
  if (!normalizedDesc) return null;
  
  // Try exact match first
  const exactMatch = mappings.find(m => m.description_pattern === normalizedDesc);
  if (exactMatch) return exactMatch.category;
  
  // Try partial match
  for (const mapping of mappings) {
    if (normalizedDesc.includes(mapping.description_pattern) || mapping.description_pattern.includes(normalizedDesc)) {
      return mapping.category;
    }
  }
  
  return null;
}

export async function saveLearnedMappings(
  userId: string, 
  originalRows: any[], 
  finalRows: any[]
): Promise<void> {
  const newMappings = new Map<string, string>();
  
  // Identify manual changes
  for (let i = 0; i < finalRows.length; i++) {
    const original = originalRows.find(r => r.id === finalRows[i].id);
    const final = finalRows[i];
    
    // If it was manually changed and is not a generic category
    if (original && final && 
        original.category !== final.category && 
        final.category !== 'outros_despesa' && 
        final.category !== 'outros_receita' &&
        !final.isLearnedCategory) {
      
      const pattern = normalizePattern(final.description);
      if (pattern) {
        newMappings.set(pattern, final.category);
      }
    }
  }
  
  if (newMappings.size === 0) return;
  
  // Upsert mappings
  for (const [pattern, category] of newMappings.entries()) {
    try {
      const { data: existing } = await supabase
        .from('category_mappings')
        .select('id, usage_count')
        .eq('user_id', userId)
        .eq('description_pattern', pattern)
        .maybeSingle();
        
      if (existing) {
        await supabase
          .from('category_mappings')
          .update({ usage_count: existing.usage_count + 1, category, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('category_mappings')
          .insert({
            user_id: userId,
            description_pattern: pattern,
            category,
            usage_count: 1
          });
      }
    } catch (e) {
      console.error('Error saving mapping:', e);
    }
  }
}
