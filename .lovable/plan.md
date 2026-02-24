

# Auditoria e Higienizacao do Fluxo de Dados

## Problemas Encontrados

### 1. Hook duplicado causando confusao de imports
O arquivo `src/hooks/useTransactions.tsx` contem uma implementacao completa e antiga do gerenciamento de transacoes, mas **nao e mais usado em nenhum lugar como hook**. Porem, 3 arquivos ainda importam **tipos** dele:

- `src/components/dashboard/Dashboard.tsx` importa `TransactionMetrics, Transaction`
- `src/components/dashboard/EditTransactionDialog.tsx` importa `Transaction`
- `src/components/dashboard/TransactionList.tsx` importa `Transaction`

Isso cria risco de tipos divergentes e confusao sobre qual e a "fonte da verdade".

### 2. Fluxo atual (o que funciona e o que pode falhar)

O fluxo correto ja esta implementado:
- **Chat** -> `ChatInterface` chama `addTransaction` do contexto -> OK
- **Manual** -> `TransactionForm` chama `addTransaction` do contexto -> OK
- **Import** -> `FileUpload` chama `addMultipleTransactions` do contexto -> OK

Todos fazem **optimistic update** (atualizam o state local imediatamente apos o insert no banco). O realtime tambem esta configurado com debounce de 500ms para sync silencioso.

**O problema real**: como os 3 componentes do dashboard importam tipos do hook antigo, qualquer divergencia futura entre os tipos do hook e do contexto quebraria a tipagem sem erro visivel.

---

## Plano de Implementacao

### Passo 1: Deletar o hook antigo
**Arquivo a deletar:** `src/hooks/useTransactions.tsx`

Este arquivo tem 410 linhas de codigo morto que:
- Duplica toda a logica do contexto
- Tem sua propria subscription realtime (sem debounce)
- Insere analytics events desnecessariamente no `calculateMetrics`
- Nunca e chamado como hook por nenhum componente

### Passo 2: Atualizar imports nos 3 arquivos afetados

**`src/components/dashboard/Dashboard.tsx`** (linha 8):
```
// DE:
import { TransactionMetrics, Transaction } from '@/hooks/useTransactions';

// PARA:
import { TransactionMetrics, Transaction } from '@/contexts/TransactionsContext';
```

**`src/components/dashboard/EditTransactionDialog.tsx`** (linha 8):
```
// DE:
import { Transaction } from '@/hooks/useTransactions';

// PARA:
import { Transaction } from '@/contexts/TransactionsContext';
```

**`src/components/dashboard/TransactionList.tsx`** (linha 7):
```
// DE:
import { Transaction } from '@/hooks/useTransactions';

// PARA:
import { Transaction } from '@/contexts/TransactionsContext';
```

### Passo 3: Verificacao pos-limpeza

Confirmar que:
- Todos os tipos `Transaction` e `TransactionMetrics` vem de uma unica fonte (`TransactionsContext`)
- O fluxo Chat -> Dashboard reflete imediatamente via optimistic update
- O fluxo Manual -> Dashboard reflete imediatamente via optimistic update
- O fluxo Import -> Dashboard reflete imediatamente via optimistic update
- O realtime continua funcionando como sync secundario (debounced 500ms)

---

## Resumo das alteracoes

| Arquivo | Acao |
|---------|------|
| `src/hooks/useTransactions.tsx` | Deletar |
| `src/components/dashboard/Dashboard.tsx` | Trocar import (1 linha) |
| `src/components/dashboard/EditTransactionDialog.tsx` | Trocar import (1 linha) |
| `src/components/dashboard/TransactionList.tsx` | Trocar import (1 linha) |

Total: 1 arquivo deletado, 3 linhas alteradas. Impacto minimo, risco zero.
