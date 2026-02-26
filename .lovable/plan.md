

# Diagnostico e Correcoes: Dashboard, Chat, Parsing e Import

## Causas Raiz Identificadas

### 1. Dashboard lento / Timeout
O console mostra "Tempo limite excedido" em 12:11:26, mas os 3 GETs em 12:10:34-35 retornaram 200 OK com dados. Causa: o realtime subscription dispara `fetchTransactions(true)` silenciosamente, e nao ha protecao contra chamadas concorrentes. Quando uma fetch silenciosa coincide com outra, o `Promise.race` com timeout de 30s pode rejeitar uma delas. Alem disso, mudancas no `toast` (referencia instavel) recriam `fetchTransactions` via useCallback, causando re-subscribe no realtime e fetches extras.

**Correcao:**
- Adicionar `fetchingRef` para impedir fetches concorrentes
- Remover `toast` da dependencia do `fetchTransactions` (usar ref)
- Nao mostrar toast de erro em refreshes silenciosos (ja esta parcialmente feito, mas o catch tambem precisa checar `silent`)

### 2. Chat timeout
O chat tem timeout de 60s, que e adequado. O problema real e que o erro de timeout do `fetchTransactions` aparece no console e o usuario confunde com erro do chat. Alem disso, apos o chat inserir uma transacao via `addTransaction`, o realtime dispara um `fetchTransactions` silencioso que pode falhar com timeout, gerando um toast de erro *aparente* no chat.

**Correcao:** Ja resolvido pelo fix do item 1 (impedir fetches concorrentes e silenciar erros em refresh silencioso).

### 3. Parsing de valores (ponto vs virgula)
- `TransactionForm`: ja faz `parseFloat(amount.replace(',', '.'))` — funciona corretamente
- `normalizeAmount`: trata formato brasileiro (remove pontos de milhar, substitui virgula por ponto) — funciona corretamente
- `actionParser`: usa `normalizeAmount` do `transactionNormalization` — funciona corretamente

Nao ha bug real no parsing individual. O problema esta na importacao de planilhas (item 4).

### 4. Importacao de planilhas com "Valor invalido"
**Causa raiz encontrada:** A funcao `normalizeTransactionRow` procura colunas com nomes especificos: `valor`, `Valor`, `amount`, etc. Se a planilha do usuario tem um nome de coluna diferente (ex: `VALOR`, `  Valor  `, `Valores`, ou com acento `Descrição`), o match falha e `rawAmount` fica como `0`, retornando "Valor inválido ou zero" para todas as linhas.

Alem disso, o XLSX pode retornar headers com espacos extras ou formatacao inesperada. A busca atual e case-sensitive e exata.

**Correcao:** Implementar busca de colunas case-insensitive e com normalizacao (trim, lowercase, remover acentos), semelhante ao pattern sugerido no stack-overflow context.

---

## Plano de Implementacao

### Passo 1: TransactionsContext — Impedir fetches concorrentes e estabilizar dependencias

**Arquivo:** `src/contexts/TransactionsContext.tsx`

- Adicionar `fetchingRef = useRef(false)` para impedir chamadas concorrentes
- Mover `toast` para um ref (`toastRef`) para remover da dependencia do `fetchTransactions`
- No `fetchTransactions`: checar `fetchingRef.current` no inicio, setar como `true`, resetar no `finally`
- No `catch` do `fetchTransactions`: nao mostrar toast quando `silent === true`

### Passo 2: Melhorar deteccao de colunas na importacao de planilhas

**Arquivo:** `src/lib/transactionNormalization.ts`

- Criar funcao `findColumnValue(row, possibleNames)` que:
  1. Tenta match exato nas chaves do row
  2. Se nao encontrar, normaliza as chaves (trim, lowercase, remover acentos) e tenta match
  3. Retorna o valor encontrado ou `undefined`
- Atualizar `normalizeTransactionRow` para usar `findColumnValue` em vez de acesso direto por chave
- Adicionar mais variantes de nomes: `VALOR`, `valores`, `montante`, `quantia`, `AMOUNT`, `VALUE`, `DESCRICAO`, `DESC`, etc.

### Passo 3: Melhorar `normalizeAmount` para mais formatos

**Arquivo:** `src/lib/transactionNormalization.ts`

- Adicionar tratamento para valores que o XLSX pode retornar como numero direto (ja funciona)
- Adicionar tratamento para string com espaco como separador de milhar: `1 234,56`
- Garantir que `"R$15,73"` (sem espaco) tambem funciona

---

## Resumo das Alteracoes

| # | Arquivo | Acao | Problema Resolvido |
|---|---------|------|--------------------|
| 1 | `src/contexts/TransactionsContext.tsx` | Guard de fetch concorrente + estabilizar deps | Timeout, fetches duplicados |
| 2 | `src/lib/transactionNormalization.ts` | Busca de colunas case-insensitive + mais formatos de valor | Import falhando |

Total: 2 arquivos modificados. Os 3 fluxos (Chat, Manual, Import) continuarao funcionando e o dashboard carregara sem timeouts espurios.

