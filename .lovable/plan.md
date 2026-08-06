# Plano de remediação — 6 sprints

Confirmado no código antes deste plano: `web-search` responde com `Access-Control-Allow-Origin: *` e sem validação de token; a dependência `xlsx@0.20.3` ainda é usada em `fileParsingService.ts`, `investmentSpreadsheetParser.ts` e `ImportWizard.tsx`; `transactions` tem o par duplicado de triggers `trg_validate_investment_fields` / `validate_investment_fields_trigger` e `analytics_events` tem 2 políticas duplicadas; `index.html` mantém `lang="en"` e título "Lovable App"; `parseQIF` existe e só é usado no `ImportWizard`; não há Vitest configurado; as abas vivem em `useState` em `Index.tsx`.

## Sprint 1 — Correções críticas (C1, C2, C3, C6)

1. `supabase/functions/web-search/index.ts`: exigir `Authorization: Bearer`, validar com `getClaims`, retornar 401 sem claims; CORS restrito a uma allowlist de origens (preview, domínio publicado, localhost) em vez de `*`, aplicada em todas as respostas incluindo erros.
2. Trocar `xlsx` pelo fork mantido `@e965/xlsx` em `package.json` e nos 3 pontos de import (`fileParsingService.ts`, `investmentSpreadsheetParser.ts`, `ImportWizard.tsx`).
3. Migração: `DROP TRIGGER validate_investment_fields_trigger` (INSERT e UPDATE), mantendo `trg_validate_investment_fields`; remover as 2 políticas duplicadas de `analytics_events` (as versões `roles:{public}`).
4. `index.html`: `lang="pt-BR"`, título e description reais do FinBot, `og:title`/`og:description`/`og:type` e `twitter:*` coerentes.

## Sprint 2 — Refatoração arquitetural (M1–M5)

Pré-requisito: escrever testes de `calculateMetrics` antes de qualquer mudança de lógica (cobrindo escopo operacional vs. investimento, meses vazios, netWorth).

1. Extrair `Transaction`, `TransactionInput`, `TransactionMetrics`, `InvestmentSummary` de `TransactionsContext.tsx` para `src/types/finance.ts` (re-export temporário para não quebrar imports).
2. `Dashboard.tsx` (métricas inline) e `financialAnalytics.getMonthlyMetrics` passam a consumir `calculateMetrics` — fim do cálculo paralelo e da divergência de escopo.
3. Reconciliação `investments` ↔ `transactions`: regra única para não somar duas vezes a mesma posição (posição custodiada + aportes lançados), documentada em comentário e coberta por teste.
4. Corrigir o offset de `monthlyNetWorth` (hoje `positionsTotal` só entra no último mês, distorcendo a série).
5. Unificar parsing de planilhas em `fileParsingService` (ImportWizard e parser de investimentos passam a chamá-lo).
6. Quebrar `ChatInterface.tsx` em `useChatContext`, `useChatScroll`, `useChatActions` + cards (`PendingAddCard`, `PendingFiscalCard`) em arquivos próprios.

## Sprint 3 — Performance (meta: chunk inicial < 400 kB)

Abas viram rotas reais (`/dashboard`, `/investimentos`, `/relatorios`, `/historico`, `/chat`) → `React.lazy` por rota → `manualChunks` para `recharts` e `xlsx` → `React.memo` em `MetricCard` e `TransactionList` → virtualização da lista do `ActivityHistoryTab` → índice composto `(user_id, created_at desc, id desc)` em `activity_log`.

## Sprint 4 — UX/UI

`DataState`/`EmptyState` em Investimentos, Relatórios e Histórico; `importErrors` também no anexo do chat; toasts padronizados sem emoji inline; auditoria de contraste dos 4 gráficos em dark mode com tokens semânticos.

## Sprint 5 — Segurança & rigor

Políticas `roles:{public}` → `{authenticated}` em `transactions`, `investments`, `profiles`, `chat_messages` (mesmas condições `auth.uid() = user_id`); ligar `strict` e `strictNullChecks` e corrigir os erros de null nos cálculos; zerar os erros de ESLint; `console.log` atrás de `import.meta.env.DEV`; validar payload de Realtime com Zod antes de entrar no estado.

## Sprint 6 — Evolução

Configurar Vitest (+ jsdom, setup) e suíte para `metricsCalculator`, `transactionNormalization`, `dateUtils`; implementar orçamentos reais (hoje stub em `financialAnalytics.ts:171`) com tabela `budgets` por categoria/mês; relatório IRPF consumindo `tax_id`/`irpf_category` via a interface `IrpfReport` já existente; expor `parseQIF` na UI de importação ou removê-lo.

## Notas técnicas

- Cada sprint é entregável isolado; migrações de banco (sprints 1, 3, 5, 6) passam por aprovação separada.
- Sprint 2 depende dos testes da sprint 6 para `metricsCalculator`: o setup do Vitest será antecipado para o início da sprint 2.
- Mudança de abas para rotas altera URLs — links salvos para `/` continuam funcionando via redirect para `/dashboard`.
