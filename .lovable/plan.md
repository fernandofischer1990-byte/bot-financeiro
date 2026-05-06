## Refatoração Completa do FinBot Copilot

Transformar o chat + transações + IA em uma arquitetura robusta, com contrato JSON estruturado, múltiplas ações por resposta, edição antes de salvar, multi-turn e ações de web search nativas.

### Objetivos
1. Eliminar parsing frágil (regex, `extractAction`, `cleanContentForDisplay` por regex).
2. Padronizar contrato `{ message, actions: [] }` com array de ações.
3. Centralizar ações em um `handleAction` único, extensível.
4. UI de confirmação editável (valor, categoria, data, descrição).
5. Estado de intent multi-turn (ex.: "gastei 50" → "qual categoria?").
6. Web search como ação explícita da IA, não heurística por keywords.
7. Otimistic updates já existem no `TransactionsContext` — manter e estender.

---

### 1. Novo contrato da IA (edge function `supabase/functions/chat/index.ts`)

Atualizar `SYSTEM_PROMPT`:
- Resposta SEMPRE: `{ "message": "...", "actions": [ {...}, {...} ] }`.
- `actions` é um **array** (permite múltiplas ações na mesma resposta).
- Tipos de ação: `add_transaction`, `delete_transaction`, `delete_all_transactions`, `web_search`, `request_clarification`.
- `request_clarification` carrega `partial` (dados já capturados) + `missing_field` para multi-turn.

Remover heurística `shouldSearchWeb` / `WEB_SEARCH_KEYWORDS` — a IA decide via `web_search` action. Manter um endpoint interno de pesquisa, mas chamado quando a action chegar do client (round-trip) ou processado server-side se `web_search` for o único action.

### 2. Novo parser (`src/lib/actionParser.ts`)

Substituir `extractAction` por:
```ts
parseAIResponse(content: string): { message: string; actions: Action[] }
```
- `JSON.parse` direto, com fallback `{ message: content, actions: [] }`.
- Validação Zod por tipo de action (discriminated union).
- Normalização de amount/category/date mantida via funções existentes.
- Remover totalmente: regex `<!--ACTION:-->`, `cleanContentForDisplay` baseado em regex (substituir por `parseAIResponse(stream).message` parcial tolerante a JSON incompleto).

### 3. Streaming tolerante a JSON parcial

Criar utilitário `extractPartialMessage(buffer)` que:
- Tenta isolar o valor de `"message": "..."` mesmo com JSON ainda em construção.
- Usado apenas para preview do streaming; ação só é processada após stream completo.

### 4. Action handler central (`ChatInterface.tsx`)

```ts
async function handleAction(action: Action) {
  switch (action.type) {
    case 'add_transaction': openConfirmation(action.payload); break;
    case 'delete_transaction': await deleteTransaction(action.payload.id); break;
    case 'delete_all_transactions': openDeleteAllConfirmation(action.payload.filter); break;
    case 'web_search': await runWebSearch(action.payload.query); break;
    case 'request_clarification': setActiveIntent(action.payload); break;
  }
}
```
Loop sobre `parsed.actions` após o stream terminar.

### 5. UI de confirmação editável

Refatorar o card `pendingAddTransaction` para um componente `<TransactionConfirmCard>`:
- Inputs editáveis: amount (text/decimal), category (Select dinâmico income/expense), date (Calendar), description.
- Estado local controlado, com valores iniciais vindos da action.
- Detecção de duplicidade já existente continua exibindo aviso.
- Aprendizado de mapeamento (`saveSingleLearnedMapping`) acionado se categoria final ≠ categoria sugerida.

### 6. Multi-turn intent

```ts
const [activeIntent, setActiveIntent] = useState<PartialIntent | null>(null);
```
- Quando IA retorna `request_clarification`, salva `partial` + `missing_field`.
- Próxima mensagem do usuário é enviada com `activeIntent` no contexto, instruindo a IA a completar.
- Limpa quando intent é resolvido (ação completa) ou usuário muda de assunto.

### 7. Web search como action

- IA decide retornar `{ type: 'web_search', payload: { query } }`.
- Client chama edge function `web-search` (nova) que usa Lovable AI para responder factual.
- Resultado é injetado como nova mensagem assistant + opcionalmente reenviado à IA principal para síntese.

### 8. Limpeza obrigatória

Remover de `src/lib/actionParser.ts` e `ChatInterface.tsx`:
- `extractAction`, `<!--ACTION:-->` regex, fallback regex de `cleanContentForDisplay`.
- `WEB_SEARCH_KEYWORDS` e `shouldSearchWeb` na edge function.

### 9. TransactionsContext

Já está adequado (optimistic updates, deleteAll com filtro). Sem mudanças estruturais — apenas garantir que `addTransaction` retorna a transação inserida (já retorna).

---

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/chat/index.ts` | Novo SYSTEM_PROMPT (actions array), remover web search heurístico |
| `supabase/functions/web-search/index.ts` | **Novo** — search via Lovable AI |
| `src/lib/actionParser.ts` | Reescrever: `parseAIResponse`, schema discriminated union, remover legacy |
| `src/lib/streamingMessage.ts` | **Novo** — `extractPartialMessage` para preview |
| `src/components/chat/ChatInterface.tsx` | `handleAction` central, multi-turn intent, integrar nova confirmação |
| `src/components/chat/TransactionConfirmCard.tsx` | **Novo** — UI editável de confirmação |
| `src/services/chatService.ts` | Sem mudança estrutural |

### Cenários de teste manual
1. "ganhei 5000 de salário" → confirmação editável → salva → dashboard atualiza.
2. "gastei 50 com uber e 30 no ifood" → 2 confirmações (actions array).
3. "gastei 50" → IA retorna `request_clarification` → "qual categoria?" → "transporte" → completa.
4. "qual a selic hoje?" → IA retorna `web_search` → resposta factual.
5. "apague todas despesas" → confirma → deleta filtrado.
6. JSON inválido / truncado → fallback exibe texto bruto, não quebra.
