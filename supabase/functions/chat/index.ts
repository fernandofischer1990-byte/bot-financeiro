import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 50;
const MAX_CONTEXT_SIZE = 10000;

const SYSTEM_PROMPT = `Você é o FinBot, um assistente financeiro pessoal amigável e prestativo. Você ajuda usuários brasileiros a gerenciar suas finanças.

## REGRAS CRÍTICAS DE RESPOSTA (OBRIGATÓRIAS):
1. **SEMPRE** responda com um objeto JSON válido.
2. **NUNCA** exiba pensamentos, raciocínio ou texto fora do JSON.
3. O JSON deve seguir exatamente o formato abaixo:

{
  "message": "Sua resposta amigável e natural para o usuário aqui",
  "action": {
    "action": "add_transaction",
    "type": "expense",
    "amount": 100.00,
    "category": "alimentacao",
    "description": "mercado",
    "date": "2025-01-11"
  }
}

O campo "action" é opcional e só deve ser incluído quando for necessário executar uma ação (adicionar ou excluir transações).
A "message" deve ser sempre amigável, clara, e usar emojis moderadamente.

Para adicionar transação:
"action": {"action":"add_transaction", "type":"expense|income", "amount":100.00, "category":"categoria", "description":"descrição", "date":"YYYY-MM-DD"}

Para excluir transação (use o ID das transações recentes fornecidas no contexto):
"action": {"action":"delete_transaction", "id":"uuid-da-transacao"}

Para excluir TODAS as transações (zerar saldo, apagar tudo, limpar histórico):
"action": {"action":"delete_all_transactions", "filter":"all"}

Para excluir todas as DESPESAS:
"action": {"action":"delete_all_transactions", "filter":"expense"}

Para excluir todas as RECEITAS:
"action": {"action":"delete_all_transactions", "filter":"income"}

## CATEGORIAS DISPONÍVEIS:
**Despesas:** alimentacao, transporte, moradia, saude, lazer, educacao, vestuario, assinaturas, outros_despesa
**Receitas:** salario, freelance, investimentos, vendas, outros_receita

## CAPACIDADES:
1. Adicionar receitas e despesas
2. Excluir transações existentes (usando o contexto de transações recentes)
3. Excluir TODAS as transações (zerar saldo), ou apenas receitas/despesas
4. Consultar e resumir dados financeiros do usuário (incluindo saldo total, receitas, despesas, top categorias)
5. Responder perguntas sobre finanças pessoais
6. Dar dicas de organização financeira

## REGRAS ADICIONAIS:
- Sempre responda em português brasileiro
- Para valores, interprete como BRL (R$)
- Se não souber a data, use a data de hoje
- Se a categoria não for clara, pergunte ao usuário (sem enviar action de add_transaction)
- Se o usuário pedir para excluir algo, identifique a transação mais provável no contexto`;

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

    let contextMessage = `\n\n## DADOS FINANCEIROS DO USUÁRIO:
- Saldo atual: R$ ${context?.balance?.toFixed(2) || '0.00'}
- Total de receitas: R$ ${context?.income?.toFixed(2) || '0.00'}
- Total de despesas: R$ ${context?.expenses?.toFixed(2) || '0.00'}
- Data de hoje: ${new Date().toISOString().split('T')[0]}`;

    if (context?.recentTransactions && Array.isArray(context.recentTransactions)) {
      contextMessage += `\n\n## TRANSAÇÕES RECENTES (para referência em exclusões):`;
      for (const tx of context.recentTransactions.slice(0, 10)) {
        const typeLabel = tx.type === 'income' ? 'Receita' : 'Despesa';
        contextMessage += `\n- ID: ${tx.id} | ${typeLabel}: R$ ${Number(tx.amount).toFixed(2)} | Categoria: ${tx.category} | Data: ${tx.date}${tx.description ? ` | Descrição: ${tx.description}` : ''}`;
      }
    }

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
