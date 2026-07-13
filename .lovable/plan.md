## Objetivo
Enriquecer os contratos de dados (`Transaction`, `Investment`) com metadados fiscais opcionais e criar a interface `IrpfReport`, preparando a fundação para o épico de Relatório Anual de IRPF sem quebrar nenhum componente atual.

Todos os novos campos são **opcionais** (`?`), portanto totalmente retrocompatíveis: nenhum construtor, serviço, formulário ou consumidor existente precisa mudar. Nenhuma migração de banco será feita agora — este passo é apenas de tipagem no frontend.

## Arquivos a alterar / criar

### 1. `src/contexts/TransactionsContext.tsx` — estender `Transaction` e `TransactionInput`
Adicionar ao final da interface `Transaction` (linhas 21–36) e espelhar em `TransactionInput` (linhas 38–49):

```ts
// Metadados fiscais (IRPF) — opcionais, populados sob demanda
taxId?: string;              // CPF/CNPJ da contraparte
irpfCategory?: string;       // Código Receita: "Despesa Médica", "Rendimento Isento" etc.
receiptUrl?: string;         // URL do comprovante (malha fina)
```

### 2. `src/types/investment.ts` — estender `Investment` e `InvestmentInput`
Adicionar aos dois blocos:

```ts
averagePrice?: number;       // Custo médio de aquisição (Bens e Direitos)
custodianCnpj?: string;      // CNPJ da corretora/custodiante
```

### 3. `src/types/irpf.ts` — novo arquivo
Criar interface `IrpfReport` estruturando a saída do futuro motor de cálculo. Cada grupo carrega `calendarYear` e `total`, mais uma lista de itens detalhados (também tipados) para permitir drill-down futuro:

```ts
export interface IrpfReportGroup<TItem> {
  calendarYear: number;
  total: number;
  items: TItem[];
}

export interface BemDireitoItem {
  code: string;              // ex: "31" Ações, "41" Poupança
  description: string;
  taxId?: string;             // CNPJ do custodiante
  situacaoAnterior: number;   // saldo em 31/12 do ano-1
  situacaoAtual: number;      // saldo em 31/12 do ano-calendário
}

export interface RendimentoIsentoItem {
  code: string;              // ex: "12" Rendimentos poupança
  sourceName: string;
  sourceTaxId?: string;
  amount: number;
}

export interface RendimentoTributavelItem {
  sourceName: string;
  sourceTaxId?: string;
  amount: number;
  withheldTax: number;
}

export interface PagamentoEfetuadoItem {
  code: string;              // ex: "10" Médicos
  beneficiaryName: string;
  beneficiaryTaxId?: string;
  amount: number;
  reimbursed?: number;
}

export interface IrpfReport {
  calendarYear: number;
  generatedAt: string;       // ISO
  bensEDireitos: IrpfReportGroup<BemDireitoItem>;
  rendimentosIsentos: IrpfReportGroup<RendimentoIsentoItem>;
  rendimentosTributaveis: IrpfReportGroup<RendimentoTributavelItem>;
  pagamentosEfetuados: IrpfReportGroup<PagamentoEfetuadoItem>;
}
```

## Verificação de retrocompatibilidade
- Todos os novos campos em `Transaction`/`TransactionInput`/`Investment`/`InvestmentInput` são opcionais → nenhum `insert…`, form, cast (`castTransaction`, `castInvestment`) ou consumidor de dashboard precisa ser modificado.
- Nenhuma alteração no schema do banco nesta etapa; PostgREST continua devolvendo as mesmas colunas e os novos campos ficarão simplesmente `undefined` até o épico seguinte adicionar colunas e mapeamento.
- `IrpfReport` é um tipo novo isolado, sem imports em código existente.
- Após aplicar, rodar `tsgo` para confirmar zero erros de tipo.

## Fora de escopo (próximos passos do épico)
- Migração SQL para persistir `tax_id`, `irpf_category`, `receipt_url`, `average_price`, `custodian_cnpj`.
- Motor de cálculo que popula `IrpfReport`.
- UI de captura destes metadados e tela de relatório.
