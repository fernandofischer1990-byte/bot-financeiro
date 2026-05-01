

## Web Search Simplificada — Usando Lovable AI Gateway (Zero Config)

### Abordagem

Em vez de configurar APIs externas (Brave, Firecrawl, Perplexity), usar o **próprio Lovable AI Gateway** que já está funcionando no projeto. Quando o usuário fizer uma pergunta que exija informações externas (cotação do dólar, Selic, CDI, etc.), o sistema faz uma **chamada separada** ao Gemini com um prompt especializado de pesquisa, antes de responder ao usuário.

**Vantagens:**
- Zero configuração extra — usa a mesma `LOVABLE_API_KEY` que já existe
- Sem novos conectores, sem chaves API, sem edge functions adicionais
- Funciona imediatamente

**Limitação:** Não é busca em tempo real — usa o conhecimento do modelo (atualizado até a data de treinamento). Para a maioria das perguntas financeiras conceituais (CDI, Selic, renda fixa, etc.) funciona muito bem. Para cotações exatas do momento, o modelo informará que os dados podem não estar 100% atualizados.

### Implementação

#### 1. Modificar `supabase/functions/chat/index.ts`

Adicionar função `shouldSearchWeb(message)` com detecção de keywords em português:
- "quanto está", "cotação", "dólar", "selic", "cdi", "inflação", "ipca", "o que é", "como funciona", "vale a pena", "taxa de juros"

Quando detectado, fazer uma chamada **não-streaming** ao Lovable AI Gateway com um prompt de pesquisa:

```text
"Você é um assistente de pesquisa financeira. Responda de forma factual e concisa sobre: {query}. 
Inclua dados numéricos quando possível. Se os dados podem estar desatualizados, avise."
```

Injetar o resultado como contexto adicional no system prompt do chat principal:

```text
## INFORMAÇÕES DE PESQUISA:
{resultado da pesquisa}
Nota: Dados baseados no conhecimento do modelo, podem não refletir valores em tempo real.
```

#### 2. Atualizar system prompt

Adicionar instrução ao `SYSTEM_PROMPT`:
- "Quando informações de pesquisa forem fornecidas no contexto, use-as para responder. Sempre avise que os dados podem não estar 100% atualizados para cotações e taxas."

#### 3. Indicador visual no frontend

Modificar `src/components/chat/ChatInterface.tsx`:
- Quando web search for ativado, mostrar um indicador "🔍 Pesquisando..." antes da resposta

Modificar `src/services/chatService.ts`:
- Nenhuma alteração necessária — tudo acontece server-side

### Fluxo

```text
Usuário: "Quanto está o dólar?"
    ↓
Edge function detecta intenção de busca
    ↓
Chamada rápida ao Gemini (pesquisa)
    ↓
Resultado injetado no contexto do LLM principal
    ↓
Resposta streaming com informações enriquecidas
```

### Evolução futura

Se quiser dados em tempo real no futuro, basta conectar o Firecrawl (1 clique) e trocar a chamada de pesquisa por uma busca real — a arquitetura já estará pronta.

### Resumo de arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chat/index.ts` | Adicionar `shouldSearchWeb()` + chamada de pesquisa ao Gateway + contexto extra |
| `src/components/chat/ChatInterface.tsx` | Indicador "Pesquisando..." durante busca |

Sem novas edge functions. Sem novos conectores. Sem chaves API. Sem alterações no banco de dados.

