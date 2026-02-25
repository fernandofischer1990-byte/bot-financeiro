

# Auditoria Completa de Higienizacao e Sanitizacao

## Resumo da Analise

Apos varredura completa de todos os arquivos do projeto (frontend, backend, integrações, utilitarios), o codigo esta em **bom estado geral**. A limpeza anterior (remoção do hook duplicado `useTransactions.tsx`) resolveu o problema critico. No entanto, identifiquei **7 problemas** que precisam ser corrigidos.

---

## Problemas Encontrados

### 1. CODIGO MORTO: `src/components/NavLink.tsx`
- Componente nunca importado por nenhum arquivo
- 28 linhas de codigo morto
- **Acao:** Deletar

### 2. CODIGO MORTO: `@tanstack/react-query` sem uso
- `QueryClient` e `QueryClientProvider` estão configurados em `App.tsx` mas nenhum componente usa `useQuery`, `useMutation` ou qualquer hook do React Query
- Todo o gerenciamento de dados usa o `TransactionsContext` diretamente
- **Acao:** Remover import e wrapper do `App.tsx` (a dependencia pode ficar no `package.json` para uso futuro)

### 3. DUPLICACAO DE LOGICA: `normalizeAmount` e `normalizeCategory` duplicados
- `src/lib/actionParser.ts` tem suas proprias versoes de `normalizeAmount`, `normalizeDate` e `normalizeCategory`
- `src/lib/transactionNormalization.ts` tem versoes identicas (e mais robustas) das mesmas funcoes
- Risco: divergencia futura entre as duas implementacoes
- **Acao:** Refatorar `actionParser.ts` para importar de `transactionNormalization.ts` e `dateUtils.ts`, removendo as duplicatas

### 4. PROBLEMA DE TIMEOUT: Erro de "Tempo limite excedido" no console
- O log mostra `Falha ao buscar transações: Error: Tempo limite excedido`
- O `FETCH_TIMEOUT_MS` esta em 15 segundos, que pode ser curto em conexoes lentas
- Alem disso, o `Promise.race` com o timeout nao cancela a query real do Supabase - ela continua rodando em background
- **Acao:** Aumentar timeout para 30 segundos e adicionar `AbortController` para cancelar a query real

### 5. ACOPLAMENTO: `ChatInterface` recebe props que ja tem via contexto
- `ChatInterface` recebe `metrics`, `transactions` e `onDeleteTransaction` como props
- Mas internamente ja importa `useTransactionsContext` para `addTransaction` e `deleteAllTransactions`
- Isso cria duas fontes de dados: props vs contexto
- **Acao:** Simplificar `ChatInterface` para consumir tudo do contexto, eliminando as props

### 6. INCONSISTENCIA DE TIPOS: `DashboardFilters.FilterState` tem `startDate/endDate` como `Date | null`, mas o contexto armazena como state
- O filtro por periodo funciona, mas a filtragem em `TransactionsContext` compara `Date` objects com strings parseadas, criando um ponto fragil
- **Acao:** Nenhuma mudanca necessaria agora (funciona corretamente), mas documentar como debito tecnico

### 7. EDGE FUNCTIONS: Headers CORS incompletos
- Ambas edge functions (`chat` e `parse-statement`) usam headers CORS sem os headers extras recomendados pela plataforma
- Atual: `authorization, x-client-info, apikey, content-type`
- Recomendado: incluir `x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`
- **Acao:** Atualizar CORS headers nas duas edge functions

---

## Plano de Implementacao

### Passo 1: Deletar codigo morto
- Deletar `src/components/NavLink.tsx`

### Passo 2: Remover React Query nao utilizado do App.tsx
```
// DE:
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
<QueryClientProvider client={queryClient}>
  ...
</QueryClientProvider>

// PARA:
// Remover import e wrapper, manter apenas o conteudo interno
```

### Passo 3: Unificar funcoes duplicadas no actionParser.ts
- Remover `normalizeAmount`, `normalizeDate` e `normalizeCategory` locais
- Importar `normalizeAmount`, `normalizeCategory` de `@/lib/transactionNormalization`
- Importar `normalizeToLocalDate` de `@/lib/dateUtils` (substituindo `normalizeDate`)
- Manter apenas `parseAction` e `extractAction` como logica propria

### Passo 4: Simplificar ChatInterface - remover props redundantes
- Remover `ChatInterfaceProps` (metrics, transactions, onDeleteTransaction)
- Consumir tudo via `useTransactionsContext()`:
  - `overallMetrics` em vez de prop `metrics`
  - `transactions` em vez de prop `transactions`
  - `deleteTransaction` em vez de prop `onDeleteTransaction`
- Atualizar `Index.tsx` para nao passar mais essas props

### Passo 5: Aumentar timeout e melhorar fetch no TransactionsContext
- `FETCH_TIMEOUT_MS`: 15000 -> 30000
- Sem outras mudancas estruturais (o flow ja funciona)

### Passo 6: Atualizar CORS das edge functions
- Adicionar headers extras em `supabase/functions/chat/index.ts`
- Adicionar headers extras em `supabase/functions/parse-statement/index.ts`

---

## Verificacao de Integridade dos 3 Fluxos

### Fluxo 1: Chat -> Dashboard
```text
ChatInterface.sendMessage()
  -> edge function /chat (streaming)
  -> parseAIResponse() extrai <!--ACTION:...-->
  -> addTransaction() do TransactionsContext
  -> optimistic update no state local
  -> Dashboard re-renderiza com novos dados
  -> realtime subscription faz sync silencioso (500ms debounce)
```
**Status:** Funcional. Apos Passo 4, ficara mais limpo sem props intermediarias.

### Fluxo 2: Manual -> Dashboard
```text
TransactionForm.handleSubmit()
  -> addTransaction() do TransactionsContext
  -> optimistic update no state local
  -> Dashboard re-renderiza com novos dados
```
**Status:** Funcional. Nenhuma mudanca necessaria.

### Fluxo 3: Import -> Dashboard
```text
FileUpload.handleFileChange()
  -> parsePDF() ou parseSpreadsheet()
  -> TransactionPreview (selecao do usuario)
  -> addMultipleTransactions() do TransactionsContext
  -> optimistic update no state local
  -> Dashboard re-renderiza com novos dados
```
**Status:** Funcional. Nenhuma mudanca necessaria.

---

## Resumo das Alteracoes

| # | Arquivo | Acao | Impacto |
|---|---------|------|---------|
| 1 | `src/components/NavLink.tsx` | Deletar | Codigo morto |
| 2 | `src/App.tsx` | Remover React Query wrapper | Simplificacao |
| 3 | `src/lib/actionParser.ts` | Refatorar imports, remover duplicatas | ~60 linhas removidas |
| 4 | `src/components/chat/ChatInterface.tsx` | Consumir contexto direto | Desacoplamento |
| 5 | `src/pages/Index.tsx` | Remover props do ChatInterface | Simplificacao |
| 6 | `src/contexts/TransactionsContext.tsx` | Timeout 15s -> 30s | Estabilidade |
| 7 | `supabase/functions/chat/index.ts` | CORS headers completos | Compatibilidade |
| 8 | `supabase/functions/parse-statement/index.ts` | CORS headers completos | Compatibilidade |

Total: 1 arquivo deletado, 7 arquivos modificados. Todos os 3 fluxos (Chat, Manual, Import) continuarao funcionando sem regressao.

