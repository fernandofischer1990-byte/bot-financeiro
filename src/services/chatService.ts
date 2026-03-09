import { supabase } from '@/integrations/supabase/client';

export interface ChatContext {
  balance: number;
  income: number;
  expenses: number;
  top_spending_categories?: Record<string, number>;
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string | null;
    date: string;
  }[];
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Send chat message to edge function and return the raw Response for SSE streaming.
 * Caller is responsible for reading the stream.
 */
export async function sendChatMessage(
  messages: ChatMessagePayload[],
  context: ChatContext,
  signal?: AbortSignal
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Você precisa estar logado para usar o chat');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      context,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = 'Erro ao enviar mensagem';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage);
  }

  return response;
}

/**
 * Read SSE stream and yield content chunks.
 */
export async function* readSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Erro de conexão');

  const decoder = new TextDecoder();
  let buffer = '';

  function* processBuffer(): Generator<string> {
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch (e) {
        console.warn('[SSE] Skipping malformed JSON chunk:', jsonStr.slice(0, 100), e);
        // Skip malformed line instead of retrying infinitely
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      yield* processBuffer();
    }

    // Flush remaining bytes from TextDecoder
    buffer += decoder.decode();

    // Process any remaining complete lines in the buffer
    if (buffer.trim()) {
      buffer += '\n'; // Ensure last line gets processed
      yield* processBuffer();
    }
  } finally {
    reader.releaseLock();
  }
}
