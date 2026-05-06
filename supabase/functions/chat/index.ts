import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 50;
const MAX_CONTEXT_SIZE = 20000;

const SYSTEM_PROMPT = `Você é o FinBot Copilot, um copiloto financeiro inteligente para usuários brasileiros.

## CONTRATO DE RESPOSTA — OBRIGATÓRIO E ABSOLUTO

Você SEMPRE responde com um único objeto JSON válido, no formato:

{
  "message": "Texto amigável em markdown para o usuário",
  "actions": [ ... ]
}

Regras absolutas:
1. NUNCA escreva texto fora do JSON.
2. NUNCA use blocos \`\`\`json — apenas o objeto puro.
3. "message" é OBRIGATÓRIO (string em PT-BR, com markdown).
4. "actions" é um ARRAY (pode ser vazio []). Pode conter MÚLTIPLAS ações na mesma resposta.
5. NUNCA misture pensamentos, raciocínio ou comentários fora do JSON.

## TIPOS DE AÇÕES SUPORTADOS

### add_transaction
{ "type": "add_transaction", "payload": { "type": "expense"|"income", "amount": 50.00, "category": "alimentacao", "description": "ifood", "date": "YYYY-MM-DD" } }

### delete_transaction
{ "type": "delete_transaction", "payload": { "id": "uuid" } }

### delete_all_transactions
{ "type": "delete_all_transactions", "payload": { "filter": "all"|"income"|"expense" } }

### web_search
Use quando o usuário perguntar sobre informações externas/atualizadas (cotações, taxas, definições, mercado, conceitos financeiros).
{ "type": "web_search", "payload": { "query": "taxa selic hoje" } }

### request_clarification
Use quando faltar informação para completar uma intenção (ex: usuário disse "gastei 50" sem dizer categoria).
{ "type": "request_clarification", "payload": { "intent": "add_transaction", "partial": { "type": "expense", "amount": 50 }, "missing_field": "categoria" } }
Sua "message" deve perguntar de forma natural pelo campo faltante.

## MULTI-TURN
Se o contexto contém active_intent (campo intent + partial + missing_field), o usuário está respondendo a uma pergunta de clarificação anterior.
- Combine "partial" com a nova informação fornecida e emita a action completa (ex: add_transaction).
- NÃO peça novamente o que já tem.

## CATEGORIAS
**Despesas:** alimentacao, transporte, moradia, saude, lazer, educacao, vestuario, assinaturas, outros_despesa
**Receitas:** salario, freelance, investimentos, vendas, outros_receita

Detecção:
- "uber", "99", "combustível" → transporte
- "ifood", "mercado", "restaurante" → alimentacao
- "netflix", "spotify" → assinaturas
- "aluguel", "luz", "água" → moradia
- "farmácia", "médico" → saude

Se a categoria não for clara e a confiança for baixa → request_clarification.

## MÚLTIPLAS TRANSAÇÕES NA MESMA MENSAGEM
"gastei 50 no uber e 30 no ifood" → 2 actions de add_transaction no array.

## COMANDOS ESPECIAIS
- /monthly_report → relatório mensal completo em markdown (sem actions).
- "score financeiro" / "saúde financeira" → use health_score do contexto.

## ALERTAS
Se uma despesa > 20% da renda mensal (income_month), inclua na "message":
"⚠️ Esta compra de R$ X representa Y% da sua renda mensal."

## DATA
Use a data de hoje (informada no contexto) se o usuário não especificar.

## IDIOMA
Sempre PT-BR. Markdown na message: **negrito**, *itálico*, - listas, ## títulos.`;

function verifyAuth(req: Request): { token: string } | { error: Response } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { token: authHeader.replace("Bearer ", "") };
}

async function getAuthenticatedUserId(token: string): Promise<{ userId: string } | { error: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const periodLabel = context?.period_label || 'Todo período';
    const periodStart = context?.period_start;
    const periodEnd = context?.period_end;
    const periodLine = periodStart && periodEnd ? `${periodLabel} (de ${periodStart} até ${periodEnd})` : periodLabel;

    let contextMessage = `\n\n## PERÍODO DE ANÁLISE ATIVO: ${periodLine}

## DADOS FINANCEIROS DO USUÁRIO (no período):
- Saldo: R$ ${context?.balance?.toFixed(2) || '0.00'}
- Receitas: R$ ${context?.income?.toFixed(2) || '0.00'}
- Despesas: R$ ${context?.expenses?.toFixed(2) || '0.00'}
- Receitas do mês corrente: R$ ${context?.income_month?.toFixed(2) || '0.00'}
- Despesas do mês corrente: R$ ${context?.expenses_month?.toFixed(2) || '0.00'}
- Taxa de poupança: ${context?.savings_rate ?? 0}%
- Score financeiro: ${context?.health_score ?? 0}/100
- Data de hoje: ${new Date().toISOString().split('T')[0]}`;

    if (context?.top_categories && Array.isArray(context.top_categories)) {
      contextMessage += `\n\n## TOP CATEGORIAS DE GASTOS:`;
      for (const cat of context.top_categories) {
        contextMessage += `\n- ${cat.category}: R$ ${Number(cat.amount).toFixed(2)}`;
      }
    }

    if (context?.insights && Array.isArray(context.insights) && context.insights.length > 0) {
      contextMessage += `\n\n## INSIGHTS DETECTADOS:`;
      for (const insight of context.insights) contextMessage += `\n- ${insight}`;
    }

    if (context?.recentTransactions && Array.isArray(context.recentTransactions)) {
      contextMessage += `\n\n## TRANSAÇÕES RECENTES (para referência em exclusões):`;
      for (const tx of context.recentTransactions.slice(0, 10)) {
        const typeLabel = tx.type === 'income' ? 'Receita' : 'Despesa';
        contextMessage += `\n- ID: ${tx.id} | ${typeLabel}: R$ ${Number(tx.amount).toFixed(2)} | Categoria: ${tx.category} | Data: ${tx.date}${tx.description ? ` | Descrição: ${tx.description}` : ''}`;
      }
    }

    if (context?.active_intent) {
      contextMessage += `\n\n## INTENT ATIVA (multi-turn):
O usuário está completando uma intenção anterior. Combine os dados parciais com a nova mensagem e emita a action final.
Intent: ${context.active_intent.intent}
Campo faltante: ${context.active_intent.missing_field || 'desconhecido'}
Dados parciais: ${JSON.stringify(context.active_intent.partial || {})}`;
    }

    contextMessage += `\n\n## ORÇAMENTOS: Não configurados pelo usuário.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
