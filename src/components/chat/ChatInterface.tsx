import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatMessages, ChatMessage } from '@/hooks/useChatMessages';
import { useTransactionsContext, TransactionMetrics, Transaction } from '@/contexts/TransactionsContext';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { extractAction } from '@/lib/actionParser';
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

interface ChatInterfaceProps {
  metrics: TransactionMetrics;
  transactions: Transaction[];
  onDeleteTransaction?: (id: string) => Promise<boolean>;
}

export function ChatInterface({ metrics, transactions, onDeleteTransaction }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingDeleteAll, setPendingDeleteAll] = useState<{ filter: 'all' | 'income' | 'expense' } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, addMessage, clearHistory } = useChatMessages();
  const { addTransaction, deleteAllTransactions } = useTransactionsContext();
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const parseAIResponse = async (content: string) => {
    const result = extractAction(content);
    
    if (!result.success || !result.action) {
      if (result.error && result.error !== 'Nenhuma ação encontrada') {
        console.warn('Action parsing failed:', result.error);
        toast({
          title: 'Não consegui registrar automaticamente',
          description: 'Por favor, me diga o valor e a categoria novamente.',
          variant: 'destructive',
        });
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
        toast({
          title: action.type === 'income' ? '💰 Receita adicionada!' : '💸 Despesa registrada!',
          description: `${formatCurrency(action.amount)} em ${getCategoryLabel(action.category)}`,
        });
      }
    } else if (action.action === 'delete_transaction' && action.id && onDeleteTransaction) {
      const success = await onDeleteTransaction(action.id);
      if (success) {
        toast({
          title: '🗑️ Transação excluída!',
        });
      }
    } else if (action.action === 'delete_all_transactions') {
      // Show confirmation dialog before mass deletion
      setPendingDeleteAll({ filter: action.filter || 'all' });
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!pendingDeleteAll) return;
    
    const count = await deleteAllTransactions(pendingDeleteAll.filter);
    setPendingDeleteAll(null);
    
    if (count > 0) {
      const label = pendingDeleteAll.filter === 'all' 
        ? `todas as ${count} transações` 
        : pendingDeleteAll.filter === 'income' 
          ? `todas as ${count} receitas` 
          : `todas as ${count} despesas`;
      
      await addMessage('assistant', `Pronto! Excluí ${label} conforme solicitado. ✅`);
    }
  };

  const cleanContentForDisplay = (content: string): string => {
    return content
      .replace(/<!--ACTION:[\s\S]*?-->/g, '')
      .replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '')
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim();
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    
    await addMessage('user', userMessage);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const recentTransactions = transactions.slice(0, 10).map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description,
        date: t.transaction_date,
      }));

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
          messages: [...messages, { role: 'user', content: userMessage }].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            balance: metrics.totalBalance,
            income: metrics.totalIncome,
            expenses: metrics.totalExpenses,
            recentTransactions,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
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
              fullContent += content;
              setStreamingContent(cleanContentForDisplay(fullContent));
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      await addMessage('assistant', fullContent);
      await parseAIResponse(fullContent);
      setStreamingContent('');

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao enviar mensagem',
        variant: 'destructive',
      });
    } finally {
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
      <ScrollArea ref={scrollRef} className="flex-1 p-4 chat-scrollbar">
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
              message={{ 
                id: 'streaming', 
                role: 'assistant', 
                content: streamingContent,
                user_id: '',
                metadata: null,
                created_at: new Date().toISOString(),
              }} 
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
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isStreaming} size="icon">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      {/* Confirmation Dialog for Mass Deletion */}
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

function MessageBubble({ message, cleanContent }: { message: ChatMessage; cleanContent: (s: string) => string }) {
  const isUser = message.role === 'user';
  
  const displayContent = isUser ? message.content : cleanContent(message.content);
  
  if (!displayContent) return null;
  
  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'p-2 rounded-full flex-shrink-0',
        isUser ? 'bg-primary' : 'bg-muted'
      )}>
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-2',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
      </div>
    </div>
  );
}
