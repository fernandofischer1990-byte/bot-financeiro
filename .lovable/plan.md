

## Filtros de Período: Dashboard e Chat

### Situação atual

O **dashboard já tem** filtros de período (Hoje, Semana, Mês, Últimos 3 meses, Personalizado). Falta apenas:
1. Opção explícita de **Trimestre** (trimestre atual e trimestre anterior)
2. **Filtros de período no chat** para que o FinBot analise apenas o intervalo escolhido

### Mudanças

#### 1. Dashboard — adicionar opção "Trimestre"

`src/components/dashboard/DashboardFilters.tsx`:
- Adicionar `'quarter'` e `'last_quarter'` ao tipo `FilterState['period']`
- Adicionar entradas em `PERIOD_OPTIONS`: "Este trimestre" e "Trimestre anterior"
- No `handlePeriodChange`, calcular início/fim usando `startOfQuarter`/`endOfQuarter` de `date-fns`, com `subQuarters` para o anterior

Sem outras alterações no Dashboard — a lógica de filtragem em `TransactionsContext` já usa `startDate`/`endDate`, então funciona automaticamente.

#### 2. Chat — novo seletor de período

`src/components/chat/ChatInterface.tsx`:
- Adicionar estado `chatPeriod` com mesmas opções (mês, trimestre, intervalo personalizado, todo período)
- Adicionar UI compacta no header do chat: um `Select` com as opções de período + popover de calendário para custom
- Calcular `transactionsInPeriod` (filtragem das transações pelo período do chat) com `useMemo`
- Recalcular as métricas que vão para `chatContext` usando esse subconjunto:
  - `monthlyMetrics`, `savingsRate`, `healthScore`, `topCategories`, `recentTransactions`, `topSpendingCategories`, `spendingInsights`
- Passar o rótulo do período no `chatContext` (novo campo `period_label`) para o LLM saber sobre qual janela está respondendo

`src/services/chatService.ts`:
- Adicionar `period_label?: string` ao tipo `ChatContext`

`supabase/functions/chat/index.ts`:
- Incluir `period_label` no `contextMessage` injetado no system prompt: "## PERÍODO DE ANÁLISE: {label}"
- Atualizar o `SYSTEM_PROMPT` para considerar o período ao responder ("Quando o usuário perguntar sobre 'gastos', refira-se ao período ativo no contexto")

#### 3. Helper compartilhado

Criar `src/lib/periodUtils.ts` com:
- Tipo `PeriodKey` (`'all' | 'today' | 'week' | 'month' | 'quarter' | 'last_quarter' | '3months' | 'custom'`)
- `getPeriodRange(period, customStart?, customEnd?)` → `{ start: Date | null, end: Date | null, label: string }`
- Usado tanto pelo `DashboardFilters` quanto pelo seletor do chat (DRY)

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/periodUtils.ts` | Novo: helper de cálculo de períodos + labels |
| `src/components/dashboard/DashboardFilters.tsx` | Adicionar opções de trimestre, refatorar para usar helper |
| `src/components/chat/ChatInterface.tsx` | Novo seletor de período + filtragem das métricas enviadas ao LLM |
| `src/services/chatService.ts` | Adicionar `period_label` ao tipo `ChatContext` |
| `supabase/functions/chat/index.ts` | Injetar período no contexto do system prompt |

Sem alterações no banco de dados.

