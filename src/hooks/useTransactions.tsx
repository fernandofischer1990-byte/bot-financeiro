import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { FilterState } from '@/components/dashboard/DashboardFilters';

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

export function useTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    period: 'all',
    type: 'all',
    category: 'all',
    startDate: null,
    endDate: null,
  });

  const calculateMetrics = useCallback((txs: Transaction[]): TransactionMetrics => {
    const startTime = performance.now();
    
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

      // By category
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;

      // Monthly data
      const monthKey = tx.transaction_date.substring(0, 7); // YYYY-MM
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

    const latency = performance.now() - startTime;
    
    // Track metrics recalculation
    if (user) {
      supabase.from('analytics_events').insert({
        user_id: user.id,
        event_name: 'metrics_recalculated',
        properties: { 
          transaction_count: txs.length,
          latency_ms: Math.round(latency),
        },
      });
    }

    return {
      totalBalance: totalIncome - totalExpenses,
      totalIncome,
      totalExpenses,
      byCategory,
      monthlyData,
    };
  }, [user]);

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Type filter
      if (filters.type !== 'all' && tx.type !== filters.type) {
        return false;
      }

      // Category filter
      if (filters.category !== 'all' && tx.category !== filters.category) {
        return false;
      }

      // Date filter
      if (filters.startDate && filters.endDate) {
        const txDate = new Date(tx.transaction_date);
        if (txDate < filters.startDate || txDate > filters.endDate) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  // Metrics based on filtered transactions
  const metrics = useMemo(() => {
    return calculateMetrics(filteredTransactions);
  }, [filteredTransactions, calculateMetrics]);

  // Overall metrics (unfiltered) for chat context
  const overallMetrics = useMemo(() => {
    return calculateMetrics(transactions);
  }, [transactions, calculateMetrics]);

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (error) {
        toast({
          title: 'Erro ao carregar transações',
          description: error.message,
          variant: 'destructive',
        });
        setTransactions([]);
        return;
      }

      const typedData = (data || []).map((tx) => ({
        ...tx,
        type: tx.type as 'income' | 'expense',
        source: tx.source as 'manual' | 'chat' | 'upload',
      }));

      setTransactions(typedData);
    } catch (err) {
      console.error('Falha ao buscar transações:', err);
      toast({
        title: 'Erro ao carregar transações',
        description: 'Falha de rede ao buscar suas transações. Tente novamente.',
        variant: 'destructive',
      });
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const addTransaction = async (input: TransactionInput): Promise<Transaction | null> => {
    if (!user) return null;

    const startTime = performance.now();

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description || null,
        transaction_date: input.transaction_date || new Date().toISOString().split('T')[0],
        source: input.source || 'manual',
      })
      .select()
      .single();

    const latency = performance.now() - startTime;

    if (error) {
      toast({
        title: 'Erro ao adicionar transação',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    // Track event
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_name: input.source === 'upload' ? 'transaction_uploaded' : 'transaction_created_manual',
      properties: {
        transaction_type: input.type,
        amount: input.amount,
        category: input.category,
        source: input.source || 'manual',
        latency_ms: Math.round(latency),
      },
    });

    return data as Transaction;
  };

  const addMultipleTransactions = async (inputs: TransactionInput[]): Promise<number> => {
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
          transaction_date: input.transaction_date || new Date().toISOString().split('T')[0],
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

    // Track upload event
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_name: 'transaction_uploaded',
      properties: {
        count: data?.length || 0,
        source: 'upload',
      },
    });

    return data?.length || 0;
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
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

    toast({
      title: '✅ Transação atualizada!',
    });

    return true;
  };

  const deleteTransaction = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Erro ao excluir transação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: '🗑️ Transação excluída!',
    });

    return true;
  };

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // Refetch and recalculate on any change
          await fetchTransactions();
          
          // Track dashboard update
          await supabase.from('analytics_events').insert({
            user_id: user.id,
            event_name: 'dashboard_updated',
            properties: { trigger: 'realtime' },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTransactions]);

  return {
    transactions,
    filteredTransactions,
    metrics,
    overallMetrics,
    loading,
    filters,
    setFilters,
    addTransaction,
    addMultipleTransactions,
    updateTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
  };
}
