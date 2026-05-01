import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Bot, Trash2, TrendingUp, TrendingDown, BarChart3, Activity, PlusCircle, CalendarIcon } from 'lucide-react';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import { extractAction, ParsedAction } from '@/lib/actionParser';
import { sendChatMessage, readSSEStream, ChatContext } from '@/services/chatService';
import { MessageBubble } from './MessageBubble';
import { PeriodKey, PERIOD_OPTIONS, getPeriodRange } from '@/lib/periodUtils';
import { parseDateOnly } from '@/lib/dateUtils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getMonthlyMetrics,
  getSavingsRate,
  getFinancialHealthScore,
  getTopCategories,
  detectSpendingInsights,
  getSpendingAlert,
} from '@/lib/financialAnalytics';
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
  try {
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const parsed = JSON.parse(content.slice(startIdx, endIdx + 1));
      if (parsed.message) return parsed.message;
    }
  } catch {
    const match = content.match(/"message"\s*:\s*"([^]*?)(?:(?<!\\)"|$)/);
    if (match) {
      return match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
  }
  
  return content
    .replace(/<!--ACTION:[\s\S]*?-->/g, '')
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim();
}

const QUICK_ACTIONS = [
  { label: 'Adicionar despesa', icon: TrendingDown },
  { label: 'Adicionar receita', icon: PlusCircle },
  { label: '/monthly_report', icon: BarChart3 },
  { label: 'Analisar meus gastos', icon: TrendingUp },
  { label: 'Score financeiro', icon: Activity },
];

export function ChatInterface() {
  const { overallMetrics: metrics, transactions, addTransaction, deleteTransaction, deleteAllTransactions } = useTransactionsContext();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingDeleteAll, setPendingDeleteAll] = useState<{ filter: 'all' | 'income' | 'expense' } | null>(null);
  const [pendingAddTransaction, setPendingAddTransaction] = useState<{ action: ParsedAction, isDuplicate: boolean } | null>(null);

  // ── Period filter for chat analysis ─────────────────────────────
  const [chatPeriod, setChatPeriod] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const insightsShownRef = useRef(false);
  const { messages, addMessage, clearHistory } = useChatMessages();
  const { toast } = useToast();

  const periodRange = useMemo(
    () => getPeriodRange(chatPeriod, customRange.start, customRange.end),
    [chatPeriod, customRange]
  );

  // Filter transactions to the active period (if any)
  const periodTransactions = useMemo(() => {
    if (!periodRange.start || !periodRange.end) return transactions;
    return transactions.filter(tx => {
      const d = parseDateOnly(tx.transaction_date);
      return d >= periodRange.start! && d <= periodRange.end!;
    });
  }, [transactions, periodRange]);

  // ── Computed analytics (scoped to active period) ────────────────
  const periodTotals = useMemo(() => {
    let income = 0, expenses = 0;
    for (const t of periodTransactions) {
      if (t.type === 'income') income += Number(t.amount);
      else expenses += Number(t.amount);
    }
    return { income, expenses, balance: income - expenses };
  }, [periodTransactions]);

  const monthlyMetrics = useMemo(() => getMonthlyMetrics(periodTransactions), [periodTransactions]);
  const savingsRate = useMemo(() => getSavingsRate(periodTotals.income, periodTotals.expenses), [periodTotals]);
  const healthScore = useMemo(() => getFinancialHealthScore(periodTransactions), [periodTransactions]);
  const topCategories = useMemo(() => getTopCategories(periodTransactions), [periodTransactions]);
  const spendingInsights = useMemo(() => detectSpendingInsights(periodTransactions), [periodTransactions]);

  const recentTransactions = useMemo(() =>
    periodTransactions.slice(0, 10).map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.transaction_date,
    })), [periodTransactions]);

  const topSpendingCategories = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const t of periodTransactions) {
      if (t.type === 'expense') {
        byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
      }
    }
    return Object.entries(byCategory)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .reduce((acc, [k,v]) => ({...acc, [k]: v}), {});
  }, [periodTransactions]);

  const chatContext: ChatContext = useMemo(() => ({
    balance: chatPeriod === 'all' ? metrics.totalBalance : periodTotals.balance,
    income: chatPeriod === 'all' ? metrics.totalIncome : periodTotals.income,
    expenses: chatPeriod === 'all' ? metrics.totalExpenses : periodTotals.expenses,
    income_month: monthlyMetrics.income_month,
    expenses_month: monthlyMetrics.expenses_month,
    savings_rate: savingsRate,
    health_score: healthScore.score,
    top_categories: topCategories,
    top_spending_categories: topSpendingCategories,
    recentTransactions,
    insights: spendingInsights,
    budgets: null,
    period_label: periodRange.label,
    period_start: periodRange.start ? format(periodRange.start, 'yyyy-MM-dd') : null,
    period_end: periodRange.end ? format(periodRange.end, 'yyyy-MM-dd') : null,
  }), [chatPeriod, metrics, periodTotals, monthlyMetrics, savingsRate, healthScore, topCategories, topSpendingCategories, recentTransactions, spendingInsights, periodRange]);

  const handleChatPeriodChange = (period: PeriodKey) => {
    if (period === 'custom') {
      setIsCustomOpen(true);
      setChatPeriod('custom');
      return;
    }
    setChatPeriod(period);
    setCustomRange({ start: null, end: null });
  };

  const handleCustomRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setCustomRange({ start: startOfDay(range.from), end: endOfDay(range.to) });
      setIsCustomOpen(false);
    }
  };

  // ── Proactive insights on chat open ─────────────────────────────
  useEffect(() => {
    if (insightsShownRef.current) return;
    if (messages.length > 0) {
      insightsShownRef.current = true;
      return;
    }
    if (transactions.length === 0) return;

    // Generate an auto-insight message
    const parts: string[] = [];
    parts.push(`📊 **Resumo rápido do mês:**`);
    parts.push(`- Receitas: R$ ${monthlyMetrics.income_month.toFixed(2)}`);
    parts.push(`- Despesas: R$ ${monthlyMetrics.expenses_month.toFixed(2)}`);
    parts.push(`- Taxa de poupança: ${savingsRate}%`);
    parts.push(`- Score financeiro: ${healthScore.score}/100`);

    if (spendingInsights.length > 0) {
      parts.push('');
      parts.push('**Insights detectados:**');
      for (const insight of spendingInsights.slice(0, 3)) {
        parts.push(`- ${insight}`);
      }
    }

    parts.push('');
    parts.push('Como posso ajudar com suas finanças hoje? 💬');

    const insightMessage = parts.join('\n');
    insightsShownRef.current = true;
    addMessage('assistant', JSON.stringify({ message: insightMessage }));
  }, [messages.length, transactions.length, monthlyMetrics, savingsRate, healthScore.score, spendingInsights, addMessage]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, streamingContent, pendingAddTransaction]);

  const parseAIResponse = useCallback(async (content: string) => {
    const result = extractAction(content);
    if (!result.success) {
      console.error("CHAT_ACTION_ERROR", { rawResponse: content, error: result.error });
      if (result.error && result.error !== 'Nenhuma ação encontrada') {
        toast({ title: 'Erro de validação', description: 'O assistente tentou executar uma ação inválida.', variant: 'destructive' });
      }
      return;
    }

    if (!result.action) return;

    const action = result.action;

    if (action.action === 'add_transaction' && action.type && action.amount && action.category) {
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
      const isDuplicate = transactions.some(t => 
        t.type === action.type && 
        Number(t.amount) === action.amount && 
        t.category === action.category &&
        new Date(t.created_at || Date.now()) > twoMinsAgo
      );

      setPendingAddTransaction({ action, isDuplicate });
    } else if (action.action === 'delete_transaction' && action.id) {
      const success = await deleteTransaction(action.id);
      if (success) toast({ title: '🗑️ Transação excluída!' });
    } else if (action.action === 'delete_all_transactions') {
      setPendingDeleteAll({ filter: action.filter || 'all' });
    }
  }, [addTransaction, deleteTransaction, toast, transactions]);

  const handleConfirmAddTransaction = async () => {
    if (!pendingAddTransaction) return;
    const { action } = pendingAddTransaction;
    try {
      const txResult = await addTransaction({
        type: action.type!,
        amount: action.amount!,
        category: action.category!,
        description: action.description || '',
        transaction_date: action.date,
        source: 'chat',
      });
      if (txResult) {
        toast({ title: action.type === 'income' ? '💰 Receita adicionada!' : '💸 Despesa registrada!', description: `${formatCurrency(action.amount!)} em ${getCategoryLabel(action.category!)}` });
      }
    } catch (e) {
      console.error('[Chat] addTransaction failed:', e);
      toast({ title: 'Erro ao registrar transação', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setPendingAddTransaction(null);
    }
  };

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
      const trimmedHistory = [...messages, { role: 'user' as const, content: userMessage }].slice(-30);
      const response = await sendChatMessage(trimmedHistory, chatContext, abortControllerRef.current.signal);

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
      console.error("CHAT_ACTION_ERROR", { error: errorMessage });
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
      setStreamingContent('');
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleClearHistory = async () => {
    insightsShownRef.current = false;
    await clearHistory();
    toast({ title: 'Histórico limpo' });
  };

  // Spending alert for pending transaction
  const spendingAlertText = useMemo(() => {
    if (!pendingAddTransaction) return null;
    const { action } = pendingAddTransaction;
    if (action.type !== 'expense' || !action.amount) return null;
    return getSpendingAlert(action.amount, monthlyMetrics.income_month);
  }, [pendingAddTransaction, monthlyMetrics.income_month]);

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-primary rounded-lg shrink-0">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">FinBot Copilot</h3>
            <p className="text-xs text-muted-foreground truncate">Seu copiloto financeiro inteligente</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClearHistory} title="Limpar histórico">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Period filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <span className="text-xs text-muted-foreground font-medium">Analisar:</span>
        <Select value={chatPeriod} onValueChange={(v) => handleChatPeriodChange(v as PeriodKey)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chatPeriod === 'custom' && (
          <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                {customRange.start && customRange.end
                  ? `${format(customRange.start, 'dd/MM')} – ${format(customRange.end, 'dd/MM')}`
                  : 'Selecionar datas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: customRange.start || undefined,
                  to: customRange.end || undefined,
                }}
                onSelect={handleCustomRangeSelect}
                locale={ptBR}
                numberOfMonths={1}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}
        {chatPeriod !== 'all' && periodRange.start && periodRange.end && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            {periodTransactions.length} transações
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 chat-scrollbar">
        <div className="space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                Olá! Sou o FinBot Copilot. 🚀<br />
                Analiso suas finanças e forneço insights inteligentes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => setInput(label)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
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
              <span className="text-sm">Analisando...</span>
            </div>
          )}
          
          {pendingAddTransaction && (
            <div className="flex justify-start">
              <div className="bg-muted p-4 rounded-lg max-w-[85%] border border-border shadow-sm">
                <h4 className="font-medium text-sm mb-2">Confirmar Transação</h4>
                {spendingAlertText && (
                  <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-3 py-1.5 mb-2 font-medium">
                    {spendingAlertText}
                  </div>
                )}
                {pendingAddTransaction.isDuplicate && (
                  <p className="text-xs text-destructive mb-2 font-medium">Esta transação parece ser duplicada. Deseja adicionar mesmo assim?</p>
                )}
                <div className="text-sm space-y-1 mb-3">
                  <p><span className="text-muted-foreground">Tipo:</span> {pendingAddTransaction.action.type === 'income' ? 'Receita' : 'Despesa'}</p>
                  <p><span className="text-muted-foreground">Valor:</span> {formatCurrency(pendingAddTransaction.action.amount!)}</p>
                  <p><span className="text-muted-foreground">Categoria:</span> {getCategoryLabel(pendingAddTransaction.action.category!)}</p>
                  {pendingAddTransaction.action.description && (
                    <p><span className="text-muted-foreground">Descrição:</span> {pendingAddTransaction.action.description}</p>
                  )}
                  {pendingAddTransaction.action.date && (
                    <p><span className="text-muted-foreground">Data:</span> {new Date(pendingAddTransaction.action.date).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmAddTransaction} className="flex-1">Confirmar</Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAddTransaction(null)} className="flex-1">Cancelar</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte sobre suas finanças..." disabled={isStreaming} className="flex-1" />
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

      {/* Confirmation Dialog for Delete All */}
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
