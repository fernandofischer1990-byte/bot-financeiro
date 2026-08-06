/**
 * Contratos de dados financeiros — fonte única da verdade.
 * `TransactionsContext` re-exporta estes tipos para compatibilidade retroativa.
 */

export type TransactionType = 'income' | 'expense' | 'investment';
export type InvestmentOperation = 'deposit' | 'withdraw' | 'yield' | 'loss';
export type FinancialScope = 'operational' | 'investment';
export type TransactionSource = 'manual' | 'chat' | 'upload';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  source: TransactionSource;
  created_at: string;
  updated_at: string;
  financial_scope: FinancialScope;
  investment_operation?: InvestmentOperation | null;
  investment_type?: string | null;
  institution?: string | null;
  // Metadados fiscais (IRPF) — opcionais, populados sob demanda
  taxId?: string;              // CPF/CNPJ da contraparte
  irpfCategory?: string;       // Código Receita: "Despesa Médica", "Rendimento Isento" etc.
  receiptUrl?: string;         // URL do comprovante (malha fina)
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  transaction_date?: string;
  source?: TransactionSource;
  financial_scope?: FinancialScope;
  investment_operation?: InvestmentOperation;
  investment_type?: string;
  institution?: string;
  // Metadados fiscais (IRPF) — opcionais
  taxId?: string;
  irpfCategory?: string;
  receiptUrl?: string;
}

export interface InvestmentSummary {
  deposits: number;
  withdraws: number;
  yields: number;
  losses: number;
  byType: Record<string, number>;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
}

export interface NetWorthPoint {
  month: string;
  available: number;
  invested: number;
  total: number;
}

export interface TransactionMetrics {
  totalBalance: number; // alias of availableBalance (back-compat)
  availableBalance: number;
  investedBalance: number;
  netWorth: number;
  totalIncome: number;
  totalExpenses: number;
  byCategory: Record<string, number>;
  monthlyData: MonthlyPoint[];
  investmentSummary: InvestmentSummary;
  monthlyNetWorth: NetWorthPoint[];
}
