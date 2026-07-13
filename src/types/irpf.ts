/**
 * Contratos de dados do Relatório Anual de IRPF (Receita Federal — Brasil).
 *
 * Estes tipos descrevem apenas a SAÍDA do futuro motor de cálculo.
 * Nenhum código existente depende deles neste momento; a introdução é
 * puramente aditiva e retrocompatível.
 */

export interface IrpfReportGroup<TItem> {
  /** Ano-calendário de referência (ex.: 2025 para a declaração entregue em 2026). */
  calendarYear: number;
  /** Soma dos valores dos itens agrupados. */
  total: number;
  /** Itens detalhados para drill-down e preenchimento linha a linha na DIRPF. */
  items: TItem[];
}

/** Ficha "Bens e Direitos". */
export interface BemDireitoItem {
  /** Código da Receita (ex.: "31" Ações, "41" Poupança, "45" Aplicação de renda fixa). */
  code: string;
  description: string;
  /** CNPJ do custodiante/instituição, quando aplicável. */
  taxId?: string;
  /** Saldo em 31/12 do ano anterior. */
  situacaoAnterior: number;
  /** Saldo em 31/12 do ano-calendário. */
  situacaoAtual: number;
}

/** Ficha "Rendimentos Isentos e Não Tributáveis". */
export interface RendimentoIsentoItem {
  /** Código da Receita (ex.: "12" Rendimentos de poupança). */
  code: string;
  sourceName: string;
  sourceTaxId?: string;
  amount: number;
}

/** Ficha "Rendimentos Tributáveis Recebidos de PJ/PF". */
export interface RendimentoTributavelItem {
  sourceName: string;
  sourceTaxId?: string;
  amount: number;
  /** IRRF retido na fonte. */
  withheldTax: number;
}

/** Ficha "Pagamentos Efetuados". */
export interface PagamentoEfetuadoItem {
  /** Código da Receita (ex.: "10" Médicos no Brasil, "01" Advogados). */
  code: string;
  beneficiaryName: string;
  beneficiaryTaxId?: string;
  amount: number;
  /** Parcela reembolsada (plano de saúde, seguradora etc.). */
  reimbursed?: number;
}

/** Estrutura completa do relatório anual pronto para exportação. */
export interface IrpfReport {
  calendarYear: number;
  /** ISO 8601 — momento da geração do relatório. */
  generatedAt: string;
  bensEDireitos: IrpfReportGroup<BemDireitoItem>;
  rendimentosIsentos: IrpfReportGroup<RendimentoIsentoItem>;
  rendimentosTributaveis: IrpfReportGroup<RendimentoTributavelItem>;
  pagamentosEfetuados: IrpfReportGroup<PagamentoEfetuadoItem>;
}
