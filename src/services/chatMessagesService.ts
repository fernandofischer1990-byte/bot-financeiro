import { supabase } from '@/integrations/supabase/client';

export interface ChatMessageRow {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchChatMessages(userId: string): Promise<{ data: ChatMessageRow[] | null; error: string | null }> {
  if (!userId) return { data: null, error: 'userId inválido' };

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) return { data: null, error: error.message };

  const mapped: ChatMessageRow[] = (data || []).map(msg => ({
    ...msg,
    role: msg.role as 'user' | 'assistant',
    metadata: msg.metadata as Record<string, unknown> | null,
  }));

  return { data: mapped, error: null };
}

export async function insertChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<{ data: ChatMessageRow | null; error: string | null }> {
  if (!userId) return { data: null, error: 'userId inválido' };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{
      user_id: userId,
      role,
      content,
      metadata: (metadata as Record<string, unknown> | null) ?? null,
    } as { user_id: string; role: string; content: string; metadata: null }])
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  return {
    data: {
      ...data,
      role: data.role as 'user' | 'assistant',
      metadata: data.metadata as Record<string, unknown> | null,
    },
    error: null,
  };
}

export async function deleteChatMessages(userId: string): Promise<{ error: string | null }> {
  if (!userId) return { error: 'userId inválido' };

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId);

  return { error: error?.message || null };
}
