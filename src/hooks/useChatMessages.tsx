import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useChatMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages((data || []).map(msg => ({
      ...msg,
      role: msg.role as 'user' | 'assistant',
      metadata: msg.metadata as Record<string, unknown> | null,
    })));
    setLoading(false);
  }, [user]);

  const addMessage = async (role: 'user' | 'assistant', content: string, metadata?: Record<string, unknown>): Promise<ChatMessage | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{
        user_id: user.id,
        role,
        content,
        metadata: (metadata as Record<string, unknown> | null) ?? null,
      } as { user_id: string; role: string; content: string; metadata: null }])
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return null;
    }

    const newMessage: ChatMessage = {
      ...data,
      role: data.role as 'user' | 'assistant',
      metadata: data.metadata as Record<string, unknown> | null,
    };

    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const clearHistory = async (): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing history:', error);
      return false;
    }

    setMessages([]);
    return true;
  };

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    addMessage,
    clearHistory,
    setMessages,
  };
}
