export type InvestmentType =
  | 'cdb'
  | 'tesouro_direto'
  | 'acoes'
  | 'fii'
  | 'criptomoedas'
  | 'previdencia'
  | 'poupanca'
  | 'etf'
  | 'renda_fixa'
  | 'fundo'
  | 'coe'
  | 'outros';

export interface Investment {
  id: string;
  user_id: string;
  investment_name: string;
  investment_type: string;
  institution: string | null;
  initial_amount: number;
  start_date: string | null;
  end_date: string | null;
  term_days: number | null;
  term_months: number | null;
  term_years: number | null;
  metadata: Record<string, unknown>;
  imported_from: string;
  source_file_name: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
  // Metadados fiscais (IRPF) — opcionais
  averagePrice?: number;       // Custo médio de aquisição (Bens e Direitos)
  custodianCnpj?: string;      // CNPJ da corretora/custodiante
}

export interface InvestmentInput {
  investment_name: string;
  investment_type?: string;
  institution?: string | null;
  initial_amount: number;
  start_date?: string | null;
  end_date?: string | null;
  term_days?: number | null;
  term_months?: number | null;
  term_years?: number | null;
  metadata?: Record<string, unknown>;
  imported_from?: string;
  source_file_name?: string | null;
  imported_at?: string | null;
}
