import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FilterState } from '@/components/dashboard/DashboardFilters';
import { parseDateOnly } from '@/lib/dateUtils';
import { calculateMetrics } from '@/lib/metricsCalculator';
import {
  fetchUserTransactions,
  insertTransaction,
  insertMultipleTransactions,
  updateTransactionById,
  deleteTransactionById,
  deleteUserTransactions,
} from '@/services/transactionService';

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

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

function sortByDateDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    b.transaction_date.localeCompare(a.transaction_date) ||
    b.created_at.localeCompare(a.created_at)
  );
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filters.type !== 'all' && tx.type !== filters.type) return false;
      if (filters.category !== 'all' && tx.category !== filters.category) return false;

      if (filters.startDate && filters.endDate) {
        const txDate = parseDateOnly(tx.transaction_date);
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (txDate < startDate || txDate > endDate) return false;
      }

      return true;
    });
  }, [transactions, filters]);

  const metrics = useMemo(() => calculateMetrics(filteredTransactions), [filteredTransactions]);
  const overallMetrics = useMemo(() => calculateMetrics(transactions), [transactions]);

  const fetchTransactions = useCallback(async (silent = false) => {
    if (authLoading) return; // auth not ready yet — do nothing
    if (!user) {
      setTransactions([]);  // user definitively logged out
      setInitialLoading(false);
      setLoadError(null);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
      setLoadError(null);
    } else if (!silent) {
      setRefreshing(true);
    }

    const { data, error } = await fetchUserTransactions(user.id);

    if (error) {
      setLoadError(error);
      if (!silent) {
        toastRef.current({ title: 'Erro ao carregar transações', description: error, variant: 'destructive' });
      }
    } else if (data) {
      setTransactions(data);
      setLoadError(null);
      hasLoadedOnce.current = true;
    } else {
      console.warn('[TransactionsContext] fetchTransactions returned empty data unexpectedly');
    }

    fetchingRef.current = false;
    setInitialLoading(false);
    setRefreshing(false);
  }, [user, authLoading]);

  const handleAddTransaction = useCallback(async (input: TransactionInput): Promise<Transaction | null> => {
    if (!user) return null;

    try {
      const { data, error } = await insertTransaction(user.id, input);

      if (error || !data) {
        toast({ title: 'Erro ao adicionar transação', description: error || 'Erro desconhecido', variant: 'destructive' });
        return null;
      }

      setTransactions(prev => sortByDateDesc([data, ...prev]));
      return data;
    } catch (e) {
      console.error('[TransactionsContext] handleAddTransaction error:', e);
      toast({ title: 'Erro ao adicionar transação', description: 'Falha de rede ou erro inesperado', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  const handleAddMultiple = useCallback(async (inputs: TransactionInput[]): Promise<number> => {
    if (!user || inputs.length === 0) return 0;

    try {
      const { data, error } = await insertMultipleTransactions(user.id, inputs);

      if (error) {
        toast({ title: 'Erro ao importar transações', description: error, variant: 'destructive' });
        return 0;
      }

      if (data.length > 0) {
        setTransactions(prev => sortByDateDesc([...data, ...prev]));
      }

      return data.length;
    } catch (e) {
      console.error('[TransactionsContext] handleAddMultiple error:', e);
      toast({ title: 'Erro ao importar transações', description: 'Falha de rede ou erro inesperado', variant: 'destructive' });
      return 0;
    }
  }, [user, toast]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    if (!user) return false;

    const now = new Date().toISOString();
    let rollback: Transaction[] | null = null;
    setTransactions(prev => {
      rollback = prev;
      return prev.map(tx => tx.id === id ? { ...tx, ...updates, updated_at: now } : tx);
    });

    try {
      const { error } = await updateTransactionById(user.id, id, updates);

      if (error) {
        if (rollback) setTransactions(rollback);
        toast({ title: 'Erro ao atualizar transação', description: error, variant: 'destructive' });
        return false;
      }

      toast({ title: '✅ Transação atualizada!' });
      return true;
    } catch (e) {
      console.error('[TransactionsContext] handleUpdate error:', e);
      if (rollback) setTransactions(rollback);
      toast({ title: 'Erro ao atualizar transação', description: 'Falha de rede ou erro inesperado', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    let rollback: Transaction[] | null = null;
    setTransactions(prev => {
      rollback = prev;
      return prev.filter(tx => tx.id !== id);
    });

    const { error } = await deleteTransactionById(user.id, id);

    if (error) {
      if (rollback) setTransactions(rollback);
      toast({ title: 'Erro ao excluir transação', description: error, variant: 'destructive' });
      return false;
    }

    toast({ title: '🗑️ Transação excluída!' });
    return true;
  }, [user, toast]);

  const handleDeleteAll = useCallback(async (filter: 'all' | 'income' | 'expense' = 'all'): Promise<number> => {
    if (!user) return 0;

    let rollback: Transaction[] | null = null;
    let count = 0;
    setTransactions(prev => {
      rollback = prev;
      const toDelete = filter === 'all' ? prev : prev.filter(tx => tx.type === filter);
      count = toDelete.length;
      if (count === 0) return prev;
      return filter === 'all' ? [] : prev.filter(tx => tx.type !== filter);
    });

    if (count === 0) {
      toast({ title: 'Nenhuma transação para excluir' });
      return 0;
    }

    const { error } = await deleteUserTransactions(user.id, filter);

    if (error) {
      if (rollback) setTransactions(rollback);
      toast({ title: 'Erro ao excluir transações', description: error, variant: 'destructive' });
      return 0;
    }

    const label = filter === 'all' ? 'Todas as transações excluídas' : filter === 'income' ? 'Todas as receitas excluídas' : 'Todas as despesas excluídas';
    toast({ title: `🗑️ ${label}! (${count})` });
    return count;
  }, [user, toast]);

  // Initial fetch — only after auth is resolved
  useEffect(() => {
    if (!authLoading) {
      fetchTransactions();
    }
  }, [authLoading, fetchTransactions]);


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
    addTransaction: handleAddTransaction,
    addMultipleTransactions: handleAddMultiple,
    updateTransaction: handleUpdate,
    deleteTransaction: handleDelete,
    deleteAllTransactions: handleDeleteAll,
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
