

# Indicador Visual de Sincronizacao no Dashboard

## O que sera adicionado

Um pequeno indicador no header do app que mostra o status da conexao realtime com o backend, para o usuario saber se seus dados estao sendo sincronizados.

## Estados visuais

```text
+-------------------+------------------+----------------------------+
| Estado            | Icone/Cor        | Texto (tooltip)            |
+-------------------+------------------+----------------------------+
| Conectado         | Circulo verde    | "Sincronizado"             |
| Sincronizando     | Loader animado   | "Sincronizando..."         |
| Erro de conexao   | Circulo vermelho | "Sem conexao - clique..."  |
+-------------------+------------------+----------------------------+
```

## Implementacao

### 1. Expor estado de conexao no TransactionsContext

**Arquivo:** `src/contexts/TransactionsContext.tsx`

- Adicionar estado `syncStatus: 'connected' | 'syncing' | 'error'` ao contexto
- Na subscription realtime (linha ~456):
  - Usar os callbacks de status do canal Supabase (`.subscribe((status) => ...)`)
  - `SUBSCRIBED` -> `syncStatus = 'connected'`
  - `CHANNEL_ERROR` / `TIMED_OUT` -> `syncStatus = 'error'`
- Quando `refreshing === true` -> `syncStatus = 'syncing'`
- Expor `syncStatus` no value do contexto

### 2. Criar componente SyncIndicator

**Novo arquivo:** `src/components/dashboard/SyncIndicator.tsx`

- Componente pequeno e discreto (circulo colorido + texto curto)
- Usa `Tooltip` do Radix para mostrar detalhes ao passar o mouse
- 3 estados visuais:
  - **connected**: circulo verde com pulso sutil + "Sincronizado"
  - **syncing**: icone `Loader2` animado + "Sincronizando..."
  - **error**: circulo vermelho + "Sem conexao" + click para `refetch()`
- Tamanho compacto para caber no header sem poluir

### 3. Posicionar no header

**Arquivo:** `src/pages/Index.tsx`

- Adicionar `<SyncIndicator />` no header, entre o logo "FinBot" e o botao "Sair"
- Consumir `syncStatus` e `refetch` do `useTransactionsContext()`

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/contexts/TransactionsContext.tsx` | Adicionar `syncStatus` ao contexto |
| `src/components/dashboard/SyncIndicator.tsx` | Criar componente novo |
| `src/pages/Index.tsx` | Inserir indicador no header |

