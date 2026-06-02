import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Investment, InvestmentInput } from '@/types/investment';
import {
  fetchUserInvestments,
  insertInvestment,
  insertMultipleInvestments,
  updateInvestmentById,
  deleteInvestmentById,
} from '@/services/investmentService';

interface InvestmentsContextValue {
  investments: Investment[];
  totalInvested: number;
  totalInitial: number;
  profit: number;
  initialLoading: boolean;
  loadError: string | null;
  refetch: () => Promise<void>;
  addInvestment: (input: InvestmentInput) => Promise<Investment | null>;
  addMultipleInvestments: (inputs: InvestmentInput[]) => Promise<number>;
  updateInvestment: (id: string, updates: Partial<InvestmentInput>) => Promise<boolean>;
  deleteInvestment: (id: string) => Promise<boolean>;
}

const CONTEXT_KEY = '__InvestmentsContext__';
const InvestmentsContext: React.Context<InvestmentsContextValue | null> =
  (globalThis as any)[CONTEXT_KEY] ??= createContext<InvestmentsContextValue | null>(null);

export function InvestmentsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const totals = useMemo(() => {
    let invested = 0, initial = 0;
    for (const inv of investments) {
      invested += Number(inv.initial_amount) || 0;
      initial += Number(inv.initial_amount) || 0;
    }
    return { invested, initial, profit: invested - initial };
  }, [investments]);

  const fetchAll = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setInvestments([]);
      setInitialLoading(false);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setInitialLoading(true);
    const { data, error } = await fetchUserInvestments(user.id);
    if (error) {
      setLoadError(error);
      console.error('[Investments] fetch error', error);
    } else if (data) {
      setInvestments(data);
      setLoadError(null);
      console.log(`[Investments] Loaded ${data.length} investments`);
    }
    fetchingRef.current = false;
    setInitialLoading(false);
  }, [user, authLoading]);

  useEffect(() => { if (!authLoading) fetchAll(); }, [authLoading, fetchAll]);

  const addInvestment = useCallback(async (input: InvestmentInput) => {
    if (!user) return null;
    const { data, error } = await insertInvestment(user.id, input);
    if (error || !data) {
      toastRef.current({ title: 'Erro ao salvar investimento', description: error || 'erro', variant: 'destructive' });
      return null;
    }
    setInvestments(prev => [data, ...prev]);
    return data;
  }, [user]);

  const addMultipleInvestments = useCallback(async (inputs: InvestmentInput[]) => {
    if (!user || inputs.length === 0) return 0;
    const { data, error } = await insertMultipleInvestments(user.id, inputs);
    if (error) {
      toastRef.current({ title: 'Erro ao importar investimentos', description: error, variant: 'destructive' });
      return 0;
    }
    if (data.length > 0) setInvestments(prev => [...data, ...prev]);
    return data.length;
  }, [user]);

  const updateInvestment = useCallback(async (id: string, updates: Partial<InvestmentInput>) => {
    if (!user) return false;
    let rollback: Investment[] | null = null;
    setInvestments(prev => {
      rollback = prev;
      return prev.map(i => i.id === id ? { ...i, ...updates } as Investment : i);
    });
    const { error } = await updateInvestmentById(user.id, id, updates);
    if (error) {
      if (rollback) setInvestments(rollback);
      toastRef.current({ title: 'Erro ao atualizar investimento', description: error, variant: 'destructive' });
      return false;
    }
    return true;
  }, [user]);

  const deleteInvestment = useCallback(async (id: string) => {
    if (!user) return false;
    let rollback: Investment[] | null = null;
    setInvestments(prev => { rollback = prev; return prev.filter(i => i.id !== id); });
    const { error } = await deleteInvestmentById(user.id, id);
    if (error) {
      if (rollback) setInvestments(rollback);
      toastRef.current({ title: 'Erro ao excluir investimento', description: error, variant: 'destructive' });
      return false;
    }
    toastRef.current({ title: '🗑️ Investimento excluído' });
    return true;
  }, [user]);

  const value: InvestmentsContextValue = useMemo(() => ({
    investments,
    totalInvested: totals.invested,
    totalInitial: totals.initial,
    profit: totals.profit,
    initialLoading,
    loadError,
    refetch: fetchAll,
    addInvestment,
    addMultipleInvestments,
    updateInvestment,
    deleteInvestment,
  }), [investments, totals, initialLoading, loadError, fetchAll, addInvestment, addMultipleInvestments, updateInvestment, deleteInvestment]);

  return <InvestmentsContext.Provider value={value}>{children}</InvestmentsContext.Provider>;
}

export function useInvestmentsContext() {
  const ctx = useContext(InvestmentsContext);
  if (!ctx) throw new Error('useInvestmentsContext must be used within InvestmentsProvider');
  return ctx;
}
