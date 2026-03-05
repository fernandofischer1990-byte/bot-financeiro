import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  ChatMessageRow,
  fetchChatMessages,
  insertChatMessage,
  deleteChatMessages,
} from '@/services/chatMessagesService';

export type ChatMessage = ChatMessageRow;

export function useChatMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('[Chat] Fetching messages for user');

    const { data, error } = await fetchChatMessages(user.id);

    if (error) {
      console.error('[Chat] Error fetching messages:', error);
    } else if (data !== null) {
      setMessages(data);
      console.log(`[Chat] Loaded ${data.length} messages`);
    }

    setLoading(false);
  }, [user]);

  const addMessage = async (role: 'user' | 'assistant', content: string, metadata?: Record<string, unknown>): Promise<ChatMessage | null> => {
    if (!user) return null;

    const { data, error } = await insertChatMessage(user.id, role, content, metadata);

    if (error || !data) {
      console.error('[Chat] Error adding message:', error);
      return null;
    }

    setMessages(prev => [...prev, data]);
    return data;
  };

  const clearHistory = async (): Promise<boolean> => {
    if (!user) return false;

    const { error } = await deleteChatMessages(user.id);

    if (error) {
      console.error('[Chat] Error clearing history:', error);
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
