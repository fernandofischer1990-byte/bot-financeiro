import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Bot, Trash2, TrendingUp, TrendingDown, BarChart3, Activity, PlusCircle, CalendarIcon, Sparkles, Globe, ArrowDown } from 'lucide-react';
import { formatCurrency, getCategoryLabel, EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVESTMENT_TYPES, INVESTMENT_OPERATIONS, getInvestmentTypeLabel, getInvestmentOperationLabel } from '@/lib/constants';
import { parseAIResponse, Action } from '@/lib/actionParser';
import { extractPartialMessage } from '@/lib/streamingMessage';
import { sendChatMessage, readSSEStream, ChatContext } from '@/services/chatService';
import { saveSingleLearnedMapping } from '@/services/categoryMappingService';
import { useAuth } from '@/hooks/useAuth';
import { MessageBubble } from './MessageBubble';
import { PeriodKey, PERIOD_OPTIONS, getPeriodRange } from '@/lib/periodUtils';
import { parseDateOnly, getLocalISODate } from '@/lib/dateUtils';
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
import { supabase } from '@/integrations/supabase/client';
import { getCachedWebSearch, setCachedWebSearch } from '@/lib/webSearchCache';

const CHAT_TIMEOUT_MS = 60000;

const QUICK_ACTIONS = [
  { label: 'Qual meu patrimônio?', icon: Activity },
  { label: 'Quanto gastei este mês?', icon: TrendingDown },
  { label: 'Analise minhas despesas', icon: BarChart3 },
  { label: 'Mostre meus investimentos', icon: TrendingUp },
  { label: 'Cotação do dólar', icon: Globe },
  { label: 'Quanto posso economizar?', icon: PlusCircle },
];

const INPUT_SUGGESTIONS = [
  'Quanto gastei com alimentação?',
  'Qual minha média mensal?',
  'Cotação do euro hoje',
  'Score financeiro',
];

type AddTxPayload = Extract<Action, { type: 'add_transaction' }>['payload'];
type ClarificationPayload = Extract<Action, { type: 'request_clarification' }>['payload'];

interface PendingAdd {
  original: AddTxPayload;
  edited: AddTxPayload;
  isDuplicate: boolean;
}

function cleanContentForDisplay(content: string): string {
  // Used for already-stored messages: parse JSON and return message field.
  return parseAIResponse(content).message || '';
}

export function ChatInterface() {
  const { user } = useAuth();
  const { transactions, addTransaction, updateTransaction, deleteTransaction, deleteAllTransactions } = useTransactionsContext();
  const { investments, updateInvestment } = useInvestmentsContext();
  const { overallMetrics: metrics } = useFinancialMetrics();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingDeleteAll, setPendingDeleteAll] = useState<{ filter: 'all' | 'income' | 'expense' } | null>(null);
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [activeIntent, setActiveIntent] = useState<ClarificationPayload | null>(null);

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

  const periodTransactions = useMemo(() => {
    if (!periodRange.start || !periodRange.end) return transactions;
    return transactions.filter(tx => {
      const d = parseDateOnly(tx.transaction_date);
      return d >= periodRange.start! && d <= periodRange.end!;
    });
  }, [transactions, periodRange]);

  const periodTotals = useMemo(() => {
    let income = 0, expenses = 0;
    for (const t of periodTransactions) {
      if (t.type === 'income') income += Number(t.amount);
      else if (t.type === 'expense') expenses += Number(t.amount);
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
    available_balance: metrics.availableBalance,
    invested_balance: metrics.investedBalance,
    net_worth: metrics.netWorth,
    investment_summary: metrics.investmentSummary,
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

  // Proactive insights
  useEffect(() => {
    if (insightsShownRef.current) return;
    if (messages.length > 0) {
      insightsShownRef.current = true;
      return;
    }
    if (transactions.length === 0) return;

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

    insightsShownRef.current = true;
    addMessage('assistant', JSON.stringify({ message: parts.join('\n'), actions: [] }));
  }, [messages.length, transactions.length, monthlyMetrics, savingsRate, healthScore.score, spendingInsights, addMessage]);

  // Smart auto-scroll: only follow when user is near the bottom; otherwise show "new message" button.
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const getViewport = useCallback((): HTMLElement | null => {
    return scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = getViewport();
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    setHasNewBelow(false);
  }, [getViewport]);

  // Track scroll position
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const handleScroll = () => {
      const threshold = 80;
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
      setIsAtBottom(atBottom);
      if (atBottom) setHasNewBelow(false);
    };
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [getViewport]);

  // Auto-scroll on new content if user is at bottom; else flag new content
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom('smooth');
    } else if (messages.length > 0 || streamingContent) {
      setHasNewBelow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streamingContent, pendingAdds]);


  // ── Web search via edge function ───────────────────────────────────
  const [webSearching, setWebSearching] = useState<string | null>(null);
  const runWebSearch = useCallback(async (query: string) => {
    setWebSearching(query);
    // Check cache first
    const cached = getCachedWebSearch(query);
    if (cached) {
      console.log('[Chat] web_search cache hit:', query);
      await addMessage('assistant', JSON.stringify({
        message: `🌐 **Resultado da pesquisa:** _${query}_\n\n${cached}\n\n_ℹ️ Resultado do cache local — pode variar em tempo real._`,
        actions: [],
      }));
      setWebSearching(null);
      return;
    }
    // Placeholder message while searching
    const placeholderMsg = `🌐 **Pesquisando na internet:** _${query}_\n\n⏳ Buscando informações atualizadas...`;
    await addMessage('assistant', JSON.stringify({ message: placeholderMsg, actions: [] }));
    try {
      const { data, error } = await supabase.functions.invoke('web-search', { body: { query } });
      if (error) throw error;
      const result = (data as { result?: string })?.result || 'Sem resultados encontrados.';
      setCachedWebSearch(query, result);
      await addMessage('assistant', JSON.stringify({
        message: `🌐 **Resultado da pesquisa:** _${query}_\n\n${result}\n\n_ℹ️ Informações obtidas via pesquisa na internet — podem variar em tempo real._`,
        actions: [],
      }));
    } catch (e) {
      console.error('[Chat] web_search failed:', e);
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      await addMessage('assistant', JSON.stringify({
        message: `❌ **Falha na pesquisa:** ${msg}\n\nTente novamente em instantes.`,
        actions: [],
      }));
      toast({ title: 'Falha na pesquisa', description: msg, variant: 'destructive' });
    } finally {
      setWebSearching(null);
    }
  }, [addMessage, toast]);

  // ── Central action handler ─────────────────────────────────────────
  const handleAction = useCallback(async (action: Action) => {
    switch (action.type) {
      case 'add_transaction': {
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
        const isDuplicate = transactions.some(t =>
          t.type === action.payload.type &&
          Number(t.amount) === action.payload.amount &&
          t.category === action.payload.category &&
          new Date(t.created_at || Date.now()) > twoMinsAgo
        );
        setPendingAdds(prev => [...prev, { original: action.payload, edited: { ...action.payload }, isDuplicate }]);
        break;
      }
      case 'delete_transaction': {
        const ok = await deleteTransaction(action.payload.id);
        if (ok) toast({ title: '🗑️ Transação excluída!' });
        break;
      }
      case 'delete_all_transactions':
        setPendingDeleteAll({ filter: action.payload.filter });
        break;
      case 'web_search':
        await runWebSearch(action.payload.query);
        break;
      case 'request_clarification':
        setActiveIntent(action.payload);
        break;
    }
  }, [transactions, deleteTransaction, toast, runWebSearch]);

  const updatePending = (idx: number, patch: Partial<AddTxPayload>) => {
    setPendingAdds(prev => prev.map((p, i) => i === idx ? { ...p, edited: { ...p.edited, ...patch } } : p));
  };

  const removePending = (idx: number) => {
    setPendingAdds(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmAdd = async (idx: number) => {
    const item = pendingAdds[idx];
    if (!item) return;
    const { edited, original } = item;
    if (!edited.amount || edited.amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    try {
      const result = await addTransaction({
        type: edited.type,
        amount: edited.amount,
        category: edited.category,
        description: edited.description || '',
        transaction_date: edited.date,
        source: 'chat',
        investment_operation: edited.investment_operation,
        investment_type: edited.investment_type,
        institution: edited.institution,
      });
      if (result) {
        const title = edited.type === 'income'
          ? '💰 Receita adicionada!'
          : edited.type === 'investment'
            ? '💼 Investimento registrado!'
            : '💸 Despesa registrada!';
        toast({
          title,
          description: `${formatCurrency(edited.amount)} em ${getCategoryLabel(edited.category)}`,
        });
        if (user && edited.type !== 'investment' && edited.description && edited.category !== original.category) {
          await saveSingleLearnedMapping(user.id, edited.description, edited.category);
          toast({ title: '🧠 Aprendi essa categoria!', description: 'Vou usar para próximas importações e mensagens.' });
        }
        setActiveIntent(null);
      }
    } catch (e) {
      console.error('[Chat] addTransaction failed:', e);
      toast({ title: 'Erro ao registrar transação', variant: 'destructive' });
    } finally {
      removePending(idx);
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!pendingDeleteAll) return;
    const count = await deleteAllTransactions(pendingDeleteAll.filter);
    setPendingDeleteAll(null);
    if (count > 0) {
      const label = pendingDeleteAll.filter === 'all' ? `todas as ${count} transações` : pendingDeleteAll.filter === 'income' ? `todas as ${count} receitas` : `todas as ${count} despesas`;
      await addMessage('assistant', JSON.stringify({ message: `Pronto! Excluí ${label} conforme solicitado. ✅`, actions: [] }));
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
      // Inject active intent hint as a synthetic system note via context
      const ctxWithIntent = activeIntent
        ? { ...chatContext, active_intent: activeIntent } as ChatContext & { active_intent: ClarificationPayload }
        : chatContext;
      const response = await sendChatMessage(trimmedHistory, ctxWithIntent, abortControllerRef.current.signal);

      let fullContent = '';
      for await (const chunk of readSSEStream(response)) {
        fullContent += chunk;
        setStreamingContent(extractPartialMessage(fullContent));
      }

      if (fullContent) {
        await addMessage('assistant', fullContent);
        const parsed = parseAIResponse(fullContent);
        // If AI returned a non-clarification action, clear pending intent
        const hasResolution = parsed.actions.some(a => a.type !== 'request_clarification');
        if (hasResolution) setActiveIntent(null);
        for (const action of parsed.actions) {
          await handleAction(action);
        }
      }
      setStreamingContent('');
    } catch (error) {
      let errorMessage = 'Falha ao enviar mensagem';
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? 'Requisição cancelada ou tempo limite excedido' : error.message;
      }
      console.error("[Chat] error:", errorMessage);
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
    setActiveIntent(null);
    setPendingAdds([]);
    await clearHistory();
    toast({ title: 'Histórico limpo' });
  };

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
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
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
                selected={{ from: customRange.start || undefined, to: customRange.end || undefined }}
                onSelect={handleCustomRangeSelect}
                locale={ptBR}
                numberOfMonths={1}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}
        {activeIntent && (
          <span className="text-[11px] text-primary ml-auto flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Aguardando: {activeIntent.missing_field || activeIntent.intent}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="h-full p-4 chat-scrollbar">
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
                message={{ id: 'streaming', role: 'assistant', content: JSON.stringify({ message: streamingContent }), user_id: '', metadata: null, created_at: new Date().toISOString() }}
                cleanContent={cleanContentForDisplay}
              />
            )}

            {isStreaming && !streamingContent && (
              <div className="flex gap-2 items-center">
                <div className="p-2 rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">FinBot está analisando</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {webSearching && (
              <div className="flex gap-2 items-center text-primary">
                <Globe className="h-4 w-4 animate-pulse" />
                <span className="text-sm">Pesquisando na internet: <em>{webSearching}</em></span>
              </div>
            )}

            {pendingAdds.map((p, idx) => (
              <PendingAddCard
                key={idx}
                pending={p}
                monthlyIncome={monthlyMetrics.income_month}
                onChange={(patch) => updatePending(idx, patch)}
                onConfirm={() => handleConfirmAdd(idx)}
                onCancel={() => removePending(idx)}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Floating "scroll to bottom" button */}
        {(!isAtBottom || hasNewBelow) && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-elegant hover:opacity-90 transition-all animate-fade-in"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {hasNewBelow ? 'Nova mensagem' : 'Ir para o final'}
          </button>
        )}
      </div>

      {/* Input */}
      <div className="p-3 lg:p-4 border-t space-y-2">

        {messages.length > 0 && !isStreaming && (
          <div className="flex gap-1.5 overflow-x-auto chat-scrollbar pb-1">
            {INPUT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeIntent?.missing_field ? `Informe: ${activeIntent.missing_field}...` : 'Pergunte sobre suas finanças...'}
            disabled={isStreaming}
            className="flex-1"
          />
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

// ── Editable confirmation card ──────────────────────────────────────
interface PendingAddCardProps {
  pending: PendingAdd;
  monthlyIncome: number;
  onChange: (patch: Partial<AddTxPayload>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function PendingAddCard({ pending, monthlyIncome, onChange, onConfirm, onCancel }: PendingAddCardProps) {
  const { edited, original, isDuplicate } = pending;
  const [isDateOpen, setIsDateOpen] = useState(false);
  const isInvestment = edited.type === 'investment';
  const categories = edited.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const alert = edited.type === 'expense' && edited.amount > 0 ? getSpendingAlert(edited.amount, monthlyIncome) : null;
  const categoryChanged = !isInvestment && edited.category !== original.category && edited.description;

  const dateObj = edited.date ? parseDateOnly(edited.date) : new Date();

  const title = isInvestment ? 'Confirmar Investimento' : edited.type === 'income' ? 'Confirmar Receita' : 'Confirmar Despesa';

  return (
    <div className="flex justify-start">
      <div className="bg-muted p-4 rounded-lg w-full max-w-[90%] border border-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{title}</h4>
          <Select value={edited.type} onValueChange={(v) => onChange({ type: v as 'income' | 'expense' | 'investment' })}>
            <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income" className="text-xs">Receita</SelectItem>
              <SelectItem value="expense" className="text-xs">Despesa</SelectItem>
              <SelectItem value="investment" className="text-xs">Investimento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {alert && (
          <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-3 py-1.5 font-medium">
            {alert}
          </div>
        )}
        {isDuplicate && (
          <p className="text-xs text-destructive font-medium">Esta transação parece duplicada. Confirma mesmo assim?</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Valor</label>
            <Input
              type="text"
              inputMode="decimal"
              value={String(edited.amount).replace('.', ',')}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.');
                const n = parseFloat(raw);
                onChange({ amount: isNaN(n) ? 0 : Math.abs(n) });
              }}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Data</label>
            <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-start font-normal">
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  {format(dateObj, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateObj}
                  onSelect={(d) => {
                    if (d) {
                      onChange({ date: getLocalISODate(d) });
                      setIsDateOpen(false);
                    }
                  }}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isInvestment ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Operação</label>
              <Select
                value={edited.investment_operation || 'deposit'}
                onValueChange={(v) => onChange({ investment_operation: v as 'deposit' | 'withdraw' | 'yield' | 'loss' })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_OPERATIONS.map(op => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">{op.icon} {op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Tipo</label>
              <Select
                value={edited.investment_type || 'outros'}
                onValueChange={(v) => onChange({ investment_type: v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground">Instituição (opcional)</label>
              <Input
                value={edited.institution || ''}
                onChange={(e) => onChange({ institution: e.target.value })}
                placeholder="Ex: Nubank, XP, BTG..."
                className="h-8 text-sm"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[11px] text-muted-foreground">Categoria</label>
            <Select value={edited.category} onValueChange={(v) => onChange({ category: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryChanged && (
              <p className="text-[11px] text-primary flex items-center gap-1 pt-1">
                <Sparkles className="h-3 w-3" />
                Vou aprender essa categoria para "{edited.description}"
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] text-muted-foreground">Descrição</label>
          <Textarea
            value={edited.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className="text-sm min-h-[40px]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onConfirm} className="flex-1">Confirmar</Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
