import { supabase } from '@/integrations/supabase/client';
import { ColumnMapping } from '@/components/import/ColumnMapper';

export interface MappingTemplate {
  id: string;
  name: string;
  mapping: ColumnMapping;
}

export async function fetchMappingTemplates(userId: string): Promise<MappingTemplate[]> {
  const { data, error } = await supabase
    .from('mapping_templates')
    .select('id, name, mapping')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching mapping templates:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    mapping: row.mapping as unknown as ColumnMapping,
  }));
}

export async function saveMappingTemplate(userId: string, name: string, mapping: ColumnMapping): Promise<boolean> {
  const { error } = await supabase
    .from('mapping_templates')
    .upsert(
      { user_id: userId, name, mapping: mapping as any },
      { onConflict: 'user_id,name' }
    );

  if (error) {
    console.error('Error saving mapping template:', error);
    return false;
  }
  return true;
}

export async function deleteMappingTemplate(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('mapping_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting mapping template:', error);
    return false;
  }
  return true;
}
