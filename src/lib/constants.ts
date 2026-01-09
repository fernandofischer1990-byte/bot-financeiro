// Categorias de transações - Português Brasil

export const EXPENSE_CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação', icon: '🍽️' },
  { value: 'transporte', label: 'Transporte', icon: '🚗' },
  { value: 'moradia', label: 'Moradia', icon: '🏠' },
  { value: 'saude', label: 'Saúde', icon: '💊' },
  { value: 'lazer', label: 'Lazer', icon: '🎮' },
  { value: 'educacao', label: 'Educação', icon: '📚' },
  { value: 'vestuario', label: 'Vestuário', icon: '👕' },
  { value: 'assinaturas', label: 'Assinaturas', icon: '📺' },
  { value: 'outros_despesa', label: 'Outros', icon: '📦' },
] as const;

export const INCOME_CATEGORIES = [
  { value: 'salario', label: 'Salário', icon: '💰' },
  { value: 'freelance', label: 'Freelance', icon: '💻' },
  { value: 'investimentos', label: 'Investimentos', icon: '📈' },
  { value: 'outros_receita', label: 'Outros', icon: '💵' },
] as const;

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: 'hsl(var(--chart-1))',
  transporte: 'hsl(var(--chart-2))',
  moradia: 'hsl(var(--chart-3))',
  saude: 'hsl(var(--chart-4))',
  lazer: 'hsl(var(--chart-5))',
  educacao: 'hsl(var(--chart-6))',
  vestuario: 'hsl(var(--chart-7))',
  assinaturas: 'hsl(var(--chart-8))',
  outros_despesa: 'hsl(var(--chart-9))',
  salario: 'hsl(var(--success))',
  freelance: 'hsl(var(--accent))',
  investimentos: 'hsl(var(--chart-2))',
  outros_receita: 'hsl(var(--chart-6))',
};

export const getCategoryLabel = (value: string): string => {
  const category = ALL_CATEGORIES.find(c => c.value === value);
  return category?.label ?? value;
};

export const getCategoryIcon = (value: string): string => {
  const category = ALL_CATEGORIES.find(c => c.value === value);
  return category?.icon ?? '📦';
};

// Formatação de moeda brasileira
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Formatação de data brasileira
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(d);
};
