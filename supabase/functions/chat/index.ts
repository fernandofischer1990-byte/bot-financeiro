import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 50;
const MAX_CONTEXT_SIZE = 15000;

const SYSTEM_PROMPT = `Você é o FinBot Copilot, um copiloto financeiro inteligente para usuários brasileiros. Você analisa finanças, detecta padrões, fornece insights proativos e ajuda a tomar melhores decisões financeiras.

## REGRAS CRÍTICAS DE RESPOSTA (OBRIGATÓRIAS):
1. **SEMPRE** responda com um objeto JSON válido.
2. **NUNCA** exiba pensamentos, raciocínio ou texto fora do JSON.
3. O JSON deve seguir exatamente o formato abaixo:

{
  "message": "Sua resposta aqui — use markdown: **negrito**, *itálico*, - listas, ## títulos",
  "action": { ... }
}

O campo "action" é opcional. A "message" deve usar markdown para formatação rica.

## AÇÕES DISPONÍVEIS:

Para adicionar transação:
"action": {"action":"add_transaction", "type":"expense|income", "amount":100.00, "category":"categoria", "description":"descrição", "date":"YYYY-MM-DD"}

Para excluir transação:
"action": {"action":"delete_transaction", "id":"uuid-da-transacao"}

Para excluir TODAS as transações:
"action": {"action":"delete_all_transactions", "filter":"all|expense|income"}

## CATEGORIAS DISPONÍVEIS:
**Despesas:** alimentacao, transporte, moradia, saude, lazer, educacao, vestuario, assinaturas, outros_despesa
**Receitas:** salario, freelance, investimentos, vendas, outros_receita

## COPILOT CAPABILITIES — ANÁLISE FINANCEIRA:

### Comando: /monthly_report
Quando o usuário enviar "/monthly_report" ou pedir um resumo mensal, gere um relatório completo usando os dados do contexto:
- Total de receitas do mês
- Total de despesas do mês
- Saldo do mês
- Top 3 categorias de gastos
- Taxa de poupança
- Score financeiro
- Maior transação (das recentes)
Formate o relatório com markdown usando **negrito**, listas e emojis.

### Análise de Gastos
Responda perguntas como:
- "Quanto gastei este mês?" → use expenses_month do contexto
- "Qual categoria gasto mais?" → use top_categories do contexto
- "Quanto sobrou?" → use balance e savings_rate
- "Quanto gastei em alimentação?" → calcule a partir das categorias

### Score Financeiro
Quando perguntado sobre "score financeiro" ou "saúde financeira":
- Use o health_score do contexto (0-100)
- Explique os fatores: taxa de poupança, diversificação de gastos, presença de renda
- Dê dicas personalizadas baseadas no score

### Alertas de Gastos
Se uma transação sendo adicionada tiver valor > 20% da renda mensal (income_month), alerte no message:
"⚠️ Esta compra de R$ X representa Y% da sua renda mensal."

### Detecção Inteligente de Categorias
Ao registrar transações via chat, detecte a categoria:
- "Uber", "99", "combustível", "estacionamento" → transporte
- "Ifood", "mercado", "restaurante", "padaria" → alimentacao
- "Netflix", "Spotify", "Disney+" → assinaturas
- "Aluguel", "condomínio", "luz", "água" → moradia
- "Farmácia", "médico", "consulta" → saude
Se a confiança for baixa, pergunte ao usuário.

### Insights Proativos
Os insights detectados são fornecidos no contexto. Quando relevante, mencione-os nas respostas para ajudar o usuário.

### Consciência de Orçamento
Se o usuário perguntar sobre orçamento, limites ou metas de gastos:
Responda: "Você ainda não configurou orçamentos por categoria. Em breve você poderá definir limites mensais para cada categoria e eu avisarei quando estiver próximo de exceder!"

## REGRAS ADICIONAIS:
- Sempre responda em português brasileiro
- Use markdown na message: **negrito**, *itálico*, - listas, ## títulos
- Para valores, interprete como BRL (R$)
- Se não souber a data, use a data de hoje
- Se a categoria não for clara, pergunte ao usuário
- Se o usuário pedir para excluir algo, identifique a transação mais provável no contexto
- Seja proativo: sugira melhorias financeiras baseadas nos dados do contexto`;

function verifyAuth(req: Request): { token: string } | { error: Response } {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { token: authHeader.replace("Bearer ", "") };
}

async function getAuthenticatedUserId(token: string): Promise<{ userId: string } | { error: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: new Response(
        JSON.stringify({ error: "Configuração de serviço incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      error: new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authCheck = verifyAuth(req);
    if ("error" in authCheck) return authCheck.error;

    const authResult = await getAuthenticatedUserId(authCheck.token);
    if ("error" in authResult) return authResult.error;

    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Muitas mensagens no histórico" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const msg of messages) {
      if (!msg?.role || !msg?.content || typeof msg.content !== 'string' || msg.content.length > MAX_MESSAGE_LENGTH || !['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: "Formato de mensagem inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (context && JSON.stringify(context).length > MAX_CONTEXT_SIZE) {
      return new Response(JSON.stringify({ error: "Dados de contexto muito grandes" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Web Search (simplificado via Lovable AI) ────────────────────
    const lastUserMessage = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')?.content || '';
    let webSearchContext = '';

    if (shouldSearchWeb(lastUserMessage)) {
      console.log("[Chat] WebSearch triggered:", lastUserMessage);
      try {
        const searchRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: "Você é um assistente de pesquisa financeira para o Brasil. Responda de forma factual, objetiva e concisa (máx 200 palavras). Inclua dados numéricos, taxas, percentuais e definições quando relevante. Se a informação puder estar desatualizada (cotações em tempo real), avise explicitamente."
              },
              { role: "user", content: lastUserMessage },
            ],
            stream: false,
          }),
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const searchText = searchData?.choices?.[0]?.message?.content || '';
          console.log("[Chat] WebSearch results:", searchText.length);
          if (searchText) {
            webSearchContext = `\n\n## INFORMAÇÕES DE PESQUISA (USE NA RESPOSTA):\n${searchText}\n\nNota: Estas informações são baseadas no conhecimento do modelo e podem não refletir valores em tempo real. Sempre avise o usuário quando se tratar de cotações, taxas ou dados de mercado.`;
          }
        } else {
          console.warn("[Chat] WebSearch failed with status:", searchRes.status);
        }
      } catch (err) {
        console.warn("[Chat] WebSearch error (non-fatal):", err);
      }
    }

    let contextMessage = `\n\n## DADOS FINANCEIROS DO USUÁRIO:
- Saldo total: R$ ${context?.balance?.toFixed(2) || '0.00'}
- Receitas totais: R$ ${context?.income?.toFixed(2) || '0.00'}
- Despesas totais: R$ ${context?.expenses?.toFixed(2) || '0.00'}
- Receitas do mês atual: R$ ${context?.income_month?.toFixed(2) || '0.00'}
- Despesas do mês atual: R$ ${context?.expenses_month?.toFixed(2) || '0.00'}
- Taxa de poupança: ${context?.savings_rate ?? 0}%
- Score financeiro: ${context?.health_score ?? 0}/100
- Data de hoje: ${new Date().toISOString().split('T')[0]}`;

    if (context?.top_categories && Array.isArray(context.top_categories)) {
      contextMessage += `\n\n## TOP CATEGORIAS DE GASTOS (mês atual):`;
      for (const cat of context.top_categories) {
        contextMessage += `\n- ${cat.category}: R$ ${Number(cat.amount).toFixed(2)}`;
      }
    }

    if (context?.insights && Array.isArray(context.insights) && context.insights.length > 0) {
      contextMessage += `\n\n## INSIGHTS DETECTADOS:`;
      for (const insight of context.insights) {
        contextMessage += `\n- ${insight}`;
      }
    }

    if (context?.recentTransactions && Array.isArray(context.recentTransactions)) {
      contextMessage += `\n\n## TRANSAÇÕES RECENTES (para referência em exclusões):`;
      for (const tx of context.recentTransactions.slice(0, 10)) {
        const typeLabel = tx.type === 'income' ? 'Receita' : 'Despesa';
        contextMessage += `\n- ID: ${tx.id} | ${typeLabel}: R$ ${Number(tx.amount).toFixed(2)} | Categoria: ${tx.category} | Data: ${tx.date}${tx.description ? ` | Descrição: ${tx.description}` : ''}`;
      }
    }

    contextMessage += `\n\n## ORÇAMENTOS: Não configurados pelo usuário.`;
    contextMessage += webSearchContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione mais créditos na sua conta." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
