import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Budget, BudgetInput, fetchBudgets, upsertBudget, deleteBudget } from '@/services/budgetService';

/** Chave de mês (YYYY-MM) de uma data. */
export function monthKeyOf(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function useBudgets(monthKey: string = monthKeyOf()) {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setBudgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchBudgets(user.id, monthKey);
    if (error) setError(error);
    else {
      setError(null);
      setBudgets(data ?? []);
    }
    setLoading(false);
  }, [user, monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (input: BudgetInput) => {
    if (!user) return false;
    const { data, error } = await upsertBudget(user.id, input);
    if (error || !data) return false;
    setBudgets((prev) => {
      const rest = prev.filter((b) => b.category !== data.category);
      return [...rest, data].sort((a, b) => a.category.localeCompare(b.category));
    });
    return true;
  };

  const remove = async (id: string) => {
    if (!user) return false;
    const { error } = await deleteBudget(user.id, id);
    if (error) return false;
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    return true;
  };

  return { budgets, loading, error, save, remove, refetch: load };
}
