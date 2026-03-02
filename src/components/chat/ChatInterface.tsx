import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Bot, Trash2 } from 'lucide-react';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import { extractAction } from '@/lib/actionParser';
import { sendChatMessage, readSSEStream } from '@/services/chatService';
import { MessageBubble } from './MessageBubble';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CHAT_TIMEOUT_MS = 60000;

function cleanContentForDisplay(content: string): string {
  return content
    .replace(/<!--ACTION:[\s\S]*?-->/g, '')
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim();
}

export function ChatInterface() {
  const { overallMetrics: metrics, transactions, addTransaction, deleteTransaction, deleteAllTransactions } = useTransactionsContext();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingDeleteAll, setPendingDeleteAll] = useState<{ filter: 'all' | 'income' | 'expense' } | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { messages, addMessage, clearHistory } = useChatMessages();
  const { toast } = useToast();

  const recentTransactions = useMemo(() =>
    transactions.slice(0, 10).map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.transaction_date,
    })), [transactions]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, streamingContent]);

  const parseAIResponse = useCallback(async (content: string) => {
    const result = extractAction(content);
    if (!result.success || !result.action) {
      if (result.error && result.error !== 'Nenhuma ação encontrada') {
        console.error('[Chat] Action extraction failed:', result.error, '\nRaw content:', content);
        toast({ title: 'Não consegui registrar automaticamente', description: 'Por favor, me diga o valor e a categoria novamente.', variant: 'destructive' });
      }
      return;
    }

    const action = result.action;

    if (action.action === 'add_transaction' && action.type && action.amount && action.category) {
      const txResult = await addTransaction({
        type: action.type,
        amount: action.amount,
        category: action.category,
        description: action.description || '',
        transaction_date: action.date,
        source: 'chat',
      });
      if (txResult) {
        toast({ title: action.type === 'income' ? '💰 Receita adicionada!' : '💸 Despesa registrada!', description: `${formatCurrency(action.amount)} em ${getCategoryLabel(action.category)}` });
      }
    } else if (action.action === 'delete_transaction' && action.id) {
      const success = await deleteTransaction(action.id);
      if (success) toast({ title: '🗑️ Transação excluída!' });
    } else if (action.action === 'delete_all_transactions') {
      setPendingDeleteAll({ filter: action.filter || 'all' });
    }
  }, [addTransaction, deleteTransaction, toast]);

  const handleConfirmDeleteAll = async () => {
    if (!pendingDeleteAll) return;
    const count = await deleteAllTransactions(pendingDeleteAll.filter);
    setPendingDeleteAll(null);
    if (count > 0) {
      const label = pendingDeleteAll.filter === 'all' ? `todas as ${count} transações` : pendingDeleteAll.filter === 'income' ? `todas as ${count} receitas` : `todas as ${count} despesas`;
      await addMessage('assistant', `Pronto! Excluí ${label} conforme solicitado. ✅`);
    }
  };

  const cancelStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setStreamingContent('');
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    await addMessage('user', userMessage);
    setIsStreaming(true);
    setStreamingContent('');

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), CHAT_TIMEOUT_MS);

    try {
      const response = await sendChatMessage(
        [...messages, { role: 'user' as const, content: userMessage }],
        { balance: metrics.totalBalance, income: metrics.totalIncome, expenses: metrics.totalExpenses, recentTransactions },
        abortControllerRef.current.signal
      );

      let fullContent = '';
      for await (const chunk of readSSEStream(response)) {
        fullContent += chunk;
        setStreamingContent(cleanContentForDisplay(fullContent));
      }

      if (fullContent) {
        await addMessage('assistant', fullContent);
        await parseAIResponse(fullContent);
      }
      setStreamingContent('');
    } catch (error) {
      let errorMessage = 'Falha ao enviar mensagem';
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? 'Requisição cancelada ou tempo limite excedido' : error.message;
      }
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
      setStreamingContent('');
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleClearHistory = async () => {
    await clearHistory();
    toast({ title: 'Histórico limpo' });
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary rounded-lg">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">FinBot</h3>
            <p className="text-xs text-muted-foreground">Seu assistente financeiro</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClearHistory} title="Limpar histórico">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 chat-scrollbar">
        <div className="space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                Olá! Sou o FinBot. 👋<br />
                Como posso ajudar com suas finanças hoje?
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {['Quanto gastei esse mês?', 'Adicionar despesa de R$ 50', 'Listar minhas transações'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} cleanContent={cleanContentForDisplay} />
          ))}

          {streamingContent && (
            <MessageBubble
              message={{ id: 'streaming', role: 'assistant', content: streamingContent, user_id: '', metadata: null, created_at: new Date().toISOString() }}
              cleanContent={cleanContentForDisplay}
            />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex gap-2 items-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Pensando...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua mensagem..." disabled={isStreaming} className="flex-1" />
          {isStreaming ? (
            <Button type="button" variant="destructive" size="icon" onClick={cancelStreaming} title="Cancelar">
              <span className="text-xs font-bold">✕</span>
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingDeleteAll} onOpenChange={(open) => !open && setPendingDeleteAll(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAll?.filter === 'all' && 'Isso irá excluir TODAS as suas transações.'}
              {pendingDeleteAll?.filter === 'income' && 'Isso irá excluir TODAS as suas receitas.'}
              {pendingDeleteAll?.filter === 'expense' && 'Isso irá excluir TODAS as suas despesas.'}
              {' '}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
