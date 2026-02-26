import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FilterState } from '@/components/dashboard/DashboardFilters';
import { getLocalISODate, parseDateOnly } from '@/lib/dateUtils';

export interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  source: 'manual' | 'chat' | 'upload';
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  transaction_date?: string;
  source?: 'manual' | 'chat' | 'upload';
}

export interface TransactionMetrics {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  byCategory: Record<string, number>;
  monthlyData: { month: string; income: number; expenses: number }[];
}

interface TransactionsContextValue {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  metrics: TransactionMetrics;
  overallMetrics: TransactionMetrics;
  initialLoading: boolean;
  refreshing: boolean;
  loadError: string | null;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  addTransaction: (input: TransactionInput) => Promise<Transaction | null>;
  addMultipleTransactions: (inputs: TransactionInput[]) => Promise<number>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  deleteAllTransactions: (filter?: 'all' | 'income' | 'expense') => Promise<number>;
  refetch: () => Promise<void>;
}

const FETCH_TIMEOUT_MS = 30000;

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  const fetchingRef = useRef(false);
  const [filters, setFilters] = useState<FilterState>({
    period: 'all',
    type: 'all',
    category: 'all',
    startDate: null,
    endDate: null,
  });

  const calculateMetrics = useCallback((txs: Transaction[]): TransactionMetrics => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const byCategory: Record<string, number> = {};
    const monthlyMap: Record<string, { income: number; expenses: number }> = {};

    for (const tx of txs) {
      const amount = Number(tx.amount);
      
      if (tx.type === 'income') {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
      }

      byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;

      const monthKey = tx.transaction_date.substring(0, 7);
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { income: 0, expenses: 0 };
      }
      if (tx.type === 'income') {
        monthlyMap[monthKey].income += amount;
      } else {
        monthlyMap[monthKey].expenses += amount;
      }
    }

    const monthlyData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
        ...data,
      }));

    return {
      totalBalance: totalIncome - totalExpenses,
      totalIncome,
      totalExpenses,
      byCategory,
      monthlyData,
    };
  }, []);

  // Apply filters using local date parsing
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filters.type !== 'all' && tx.type !== filters.type) {
        return false;
      }

      if (filters.category !== 'all' && tx.category !== filters.category) {
        return false;
      }

      if (filters.startDate && filters.endDate) {
        const txDate = parseDateOnly(tx.transaction_date);
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        if (txDate < startDate || txDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  const metrics = useMemo(() => calculateMetrics(filteredTransactions), [filteredTransactions, calculateMetrics]);
  const overallMetrics = useMemo(() => calculateMetrics(transactions), [transactions, calculateMetrics]);

  const fetchTransactions = useCallback(async (silent = false) => {
    if (!user) {
      setTransactions([]);
      setInitialLoading(false);
      setLoadError(null);
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Only show skeleton on initial load, not on refreshes
    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
      setLoadError(null);
    } else if (!silent) {
      setRefreshing(true);
    }

    try {
      // Timeout para evitar carregamento infinito
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Tempo limite excedido')), FETCH_TIMEOUT_MS)
      );
      
      const fetchPromise = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        const errorMsg = error.message || 'Erro ao carregar transações';
        setLoadError(errorMsg);
        if (!silent) {
          toastRef.current({
            title: 'Erro ao carregar transações',
            description: errorMsg,
            variant: 'destructive',
          });
        }
        return;
      }

      const typedData = (data || []).map((tx) => ({
        ...tx,
        type: tx.type as 'income' | 'expense',
        source: tx.source as 'manual' | 'chat' | 'upload',
      }));

      setTransactions(typedData);
      setLoadError(null);
      hasLoadedOnce.current = true;
    } catch (err) {
      console.error('Falha ao buscar transações:', err);
      if (!silent) {
        const errorMsg = err instanceof Error && err.message === 'Tempo limite excedido'
          ? 'Tempo limite excedido. Verifique sua conexão.'
          : 'Falha de rede. Tente novamente.';
        setLoadError(errorMsg);
        toastRef.current({
          title: 'Erro ao carregar transações',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } finally {
      fetchingRef.current = false;
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const addTransaction = useCallback(async (input: TransactionInput): Promise<Transaction | null> => {
    if (!user) return null;

    const transactionDate = input.transaction_date || getLocalISODate();

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description || null,
        transaction_date: transactionDate,
        source: input.source || 'manual',
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao adicionar transação',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    const newTransaction: Transaction = {
      ...data,
      type: data.type as 'income' | 'expense',
      source: data.source as 'manual' | 'chat' | 'upload',
    };

    // Optimistic update: add to state immediately
    setTransactions(prev => {
      // Sort by date descending after adding
      const updated = [newTransaction, ...prev];
      return updated.sort((a, b) => 
        b.transaction_date.localeCompare(a.transaction_date) || 
        b.created_at.localeCompare(a.created_at)
      );
    });

    return newTransaction;
  }, [user, toast]);

  const addMultipleTransactions = useCallback(async (inputs: TransactionInput[]): Promise<number> => {
    if (!user || inputs.length === 0) return 0;

    const { data, error } = await supabase
      .from('transactions')
      .insert(
        inputs.map(input => ({
          user_id: user.id,
          type: input.type,
          amount: input.amount,
          category: input.category,
          description: input.description || null,
          transaction_date: input.transaction_date || getLocalISODate(),
          source: input.source || 'upload',
        }))
      )
      .select();

    if (error) {
      toast({
        title: 'Erro ao importar transações',
        description: error.message,
        variant: 'destructive',
      });
      return 0;
    }

    // Optimistic update: add all new transactions
    if (data && data.length > 0) {
      const newTransactions: Transaction[] = data.map(tx => ({
        ...tx,
        type: tx.type as 'income' | 'expense',
        source: tx.source as 'manual' | 'chat' | 'upload',
      }));

      setTransactions(prev => {
        const updated = [...newTransactions, ...prev];
        return updated.sort((a, b) => 
          b.transaction_date.localeCompare(a.transaction_date) || 
          b.created_at.localeCompare(a.created_at)
        );
      });
    }

    return data?.length || 0;
  }, [user, toast]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('transactions')
      .update({
        type: updates.type,
        amount: updates.amount,
        category: updates.category,
        description: updates.description,
        transaction_date: updates.transaction_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar transação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    // Optimistic update
    setTransactions(prev => prev.map(tx => 
      tx.id === id 
        ? { ...tx, ...updates, updated_at: new Date().toISOString() } 
        : tx
    ));

    toast({ title: '✅ Transação atualizada!' });
    return true;
  }, [user, toast]);

  const deleteTransaction = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    // Optimistic update: remove immediately
    const previousTransactions = transactions;
    setTransactions(prev => prev.filter(tx => tx.id !== id));

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      // Rollback on error
      setTransactions(previousTransactions);
      toast({
        title: 'Erro ao excluir transação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({ title: '🗑️ Transação excluída!' });
    return true;
  }, [user, toast, transactions]);

  const deleteAllTransactions = useCallback(async (filter: 'all' | 'income' | 'expense' = 'all'): Promise<number> => {
    if (!user) return 0;

    // Count how many will be deleted for feedback
    const toDelete = filter === 'all' 
      ? transactions 
      : transactions.filter(tx => tx.type === filter);
    
    const count = toDelete.length;
    
    if (count === 0) {
      toast({ title: 'Nenhuma transação para excluir' });
      return 0;
    }

    // Optimistic update: remove immediately
    const previousTransactions = transactions;
    setTransactions(prev => 
      filter === 'all' 
        ? [] 
        : prev.filter(tx => tx.type !== filter)
    );

    try {
      let query = supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { error } = await query;

      if (error) {
        // Rollback on error
        setTransactions(previousTransactions);
        toast({
          title: 'Erro ao excluir transações',
          description: error.message,
          variant: 'destructive',
        });
        return 0;
      }

      const label = filter === 'all' 
        ? 'Todas as transações excluídas' 
        : filter === 'income' 
          ? 'Todas as receitas excluídas' 
          : 'Todas as despesas excluídas';
      
      toast({ title: `🗑️ ${label}! (${count})` });
      return count;
    } catch (err) {
      setTransactions(previousTransactions);
      toast({
        title: 'Erro ao excluir transações',
        description: 'Falha de rede. Tente novamente.',
        variant: 'destructive',
      });
      return 0;
    }
  }, [user, toast, transactions]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Realtime subscription with debounced silent refresh
  useEffect(() => {
    if (!user) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel('transactions-realtime-provider')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Debounce realtime events to avoid rapid refetches
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchTransactions(true); // Silent refresh
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchTransactions]);

  const value: TransactionsContextValue = {
    transactions,
    filteredTransactions,
    metrics,
    overallMetrics,
    initialLoading,
    refreshing,
    loadError,
    filters,
    setFilters,
    addTransaction,
    addMultipleTransactions,
    updateTransaction,
    deleteTransaction,
    deleteAllTransactions,
    refetch: () => fetchTransactions(false),
  };

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactionsContext() {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error('useTransactionsContext must be used within TransactionsProvider');
  }
  return context;
}
