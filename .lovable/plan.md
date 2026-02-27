

# Refatoracao Completa do FinBot

## Diagnostico

Apos analisar todos os arquivos do projeto, identifiquei os seguintes problemas:

### Problemas de Arquitetura
1. **TransactionsContext.tsx (521 linhas)** — arquivo monolitico que mistura: estado, logica de negocio (CRUD), metricas, filtros, realtime e toasts
2. **ChatInterface.tsx (417 linhas)** — mistura UI, streaming SSE, parsing de acoes, logica de negocio (adicionar/excluir transacoes)
3. **FileUpload.tsx (329 linhas)** — mistura UI, leitura de arquivos, chamada de edge function, normalizacao de dados
4. **Duplicacao de logica de parsing de valores** — `EditTransactionDialog` tem seu proprio `parseAmountBR`, `TransactionForm` faz `parseFloat(amount.replace(',', '.'))`, e `transactionNormalization.ts` tem `normalizeAmount`. Tres implementacoes diferentes
5. **Edge functions** duplicam o pattern de auth verification (chat e parse-statement tem codigo identico de `verifyAuth`)
6. **Sem camada de servico** — componentes chamam `supabase` diretamente em varios lugares

### Problemas de Qualidade
7. `ChatInterface` importa `useTransactionsContext` duas vezes (linhas 25 e 33)
8. `cleanContentForDisplay` usa regex frágil que pode remover conteudo legitimo
9. `useChatMessages` nao tem tratamento de timeout
10. `suggestCategory` em `categoryMapping.ts` e importado mas pouco usado — a normalizacao ja cobre isso

---

## Plano de Implementacao

### Passo 1: Criar camada de servicos no frontend

**Novo arquivo: `src/services/transactionService.ts`**
- Extrair toda logica de CRUD de transacoes do `TransactionsContext` para funcoes puras
- Funcoes: `fetchUserTransactions`, `insertTransaction`, `insertMultipleTransactions`, `updateTransaction`, `deleteTransaction`, `deleteUserTransactions`
- Cada funcao recebe `userId` e retorna `{ data, error }`
- Centralizar o timeout pattern (usar `AbortSignal.timeout()`)

**Novo arquivo: `src/services/chatService.ts`**
- Extrair a chamada ao edge function `chat` do `ChatInterface`
- Funcao: `sendChatMessage(messages, context, signal)` que retorna ReadableStream
- Centralizar headers e URL construction

**Novo arquivo: `src/services/fileParsingService.ts`**
- Extrair `parsePDF` do `FileUpload` para funcao: `parseStatementPDF(base64)`
- Extrair `parseSpreadsheet` para funcao: `parseSpreadsheetFile(file)`

### Passo 2: Unificar parsing de valores numericos

**Arquivo: `src/lib/transactionNormalization.ts`**
- Exportar `normalizeAmount` como a UNICA funcao de parsing de valores
- Remover `parseAmountBR` do `EditTransactionDialog` — usar `normalizeAmount` no lugar
- Remover `parseFloat(amount.replace(',', '.'))` do `TransactionForm` — usar `normalizeAmount`

### Passo 3: Refatorar TransactionsContext

**Arquivo: `src/contexts/TransactionsContext.tsx`**
- Manter apenas: estado, dispatch de acoes, calculo de metricas, realtime subscription
- Delegar CRUD para `transactionService.ts`
- Extrair `calculateMetrics` para `src/lib/metricsCalculator.ts`
- Reduzir de ~520 linhas para ~250 linhas

### Passo 4: Refatorar ChatInterface

**Arquivo: `src/components/chat/ChatInterface.tsx`**
- Extrair logica de streaming SSE para hook `src/hooks/useChatStream.ts`
- Extrair `parseAIResponse` para o hook — manter componente puramente visual
- Extrair `MessageBubble` para `src/components/chat/MessageBubble.tsx`
- Remover import duplicado de `useTransactionsContext`
- Reduzir de ~417 linhas para ~150 linhas

### Passo 5: Refatorar FileUpload

**Arquivo: `src/components/transactions/FileUpload.tsx`**
- Delegar parsing para `fileParsingService.ts`
- Manter apenas: UI de upload, preview state, botoes de acao
- Reduzir de ~329 linhas para ~150 linhas

### Passo 6: Limpeza e higienizacao

- Remover `console.debug` e `console.warn` desnecessarios
- Remover import nao usado de `suggestCategory` em `FileUpload.tsx` (linha 10)
- Padronizar nomes: todos os servicos em ingles, UI labels em portugues
- Remover codigo morto

### Passo 7: Backend — Unificar auth verification nas edge functions

**Novo arquivo: `supabase/functions/_shared/auth.ts`**
- Extrair `verifyAuth` e `corsHeaders` compartilhados
- Importar em `chat/index.ts` e `parse-statement/index.ts`

> Nota: Edge functions nao suportam subpastas de codigo compartilhado via import de `_shared/` diretamente no deploy do Lovable Cloud. A alternativa e duplicar o codigo de auth mas padroniza-lo (manter identico). Vou manter inline mas padronizado.

### Passo 8: Melhorar performance do dashboard

- No `calculateMetrics`, os calculos ja sao O(n) e memoizados — nao ha gargalo real
- A query `select('*')` retorna todas as colunas; otimizar para `select('id,type,amount,category,description,transaction_date,source,created_at,updated_at')`
- Adicionar `limit(1000)` explicito para deixar claro o limite

---

## Resumo de Arquivos

| Acao | Arquivo | Motivo |
|------|---------|--------|
| Criar | `src/services/transactionService.ts` | Camada de servico para CRUD |
| Criar | `src/services/chatService.ts` | Chamada ao chat edge function |
| Criar | `src/services/fileParsingService.ts` | Parsing de arquivos |
| Criar | `src/lib/metricsCalculator.ts` | Calculo de metricas extraido |
| Criar | `src/hooks/useChatStream.ts` | Logica de streaming SSE |
| Criar | `src/components/chat/MessageBubble.tsx` | Componente de bolha de mensagem |
| Editar | `src/contexts/TransactionsContext.tsx` | Delegar para servicos |
| Editar | `src/components/chat/ChatInterface.tsx` | Usar hooks e servicos |
| Editar | `src/components/transactions/FileUpload.tsx` | Usar servicos |
| Editar | `src/components/transactions/TransactionForm.tsx` | Usar `normalizeAmount` |
| Editar | `src/components/dashboard/EditTransactionDialog.tsx` | Usar `normalizeAmount` |
| Editar | `src/lib/transactionNormalization.ts` | Exportar `formatAmountBR` |

Total: 6 novos arquivos, 6 arquivos editados. Nenhuma alteracao no banco de dados.

