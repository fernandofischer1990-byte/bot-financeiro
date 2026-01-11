import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation constants
const MAX_MESSAGE_LENGTH = 10000; // 10KB per message
const MAX_MESSAGES = 50; // Limit conversation history
const MAX_CONTEXT_SIZE = 10000; // Context data size

const SYSTEM_PROMPT = `Você é o FinBot, um assistente financeiro pessoal amigável e prestativo. Você ajuda usuários brasileiros a gerenciar suas finanças.

## REGRAS CRÍTICAS DE RESPOSTA (OBRIGATÓRIAS):
1. **NUNCA** exiba JSON, objetos, código ou estruturas técnicas na resposta ao usuário
2. **NUNCA** mostre seu raciocínio interno, pensamentos ou análise
3. **SEMPRE** responda em linguagem natural clara, amigável e concisa
4. Quando executar uma ação, confirme em texto natural e conversacional
5. Use emojis moderadamente para tornar a conversa agradável
6. Mantenha o foco em finanças pessoais - redirecione gentilmente se o usuário desviar

## FORMATO DE AÇÕES (INVISÍVEL AO USUÁRIO):
Quando precisar executar uma ação, inclua o JSON em um comentário HTML que será processado pelo sistema e removido da resposta visível:

Para adicionar transação:
<!--ACTION:{"action":"add_transaction","type":"expense|income","amount":100.00,"category":"categoria","description":"descrição","date":"YYYY-MM-DD"}-->

Para excluir transação (use o ID das transações recentes fornecidas no contexto):
<!--ACTION:{"action":"delete_transaction","id":"uuid-da-transacao"}-->

## CATEGORIAS DISPONÍVEIS:
**Despesas:** alimentacao, transporte, moradia, saude, lazer, educacao, vestuario, assinaturas, outros_despesa
**Receitas:** salario, freelance, investimentos, outros_receita

## CAPACIDADES:
1. Adicionar receitas e despesas
2. Excluir transações existentes (usando o contexto de transações recentes)
3. Consultar e resumir dados financeiros do usuário
4. Responder perguntas sobre finanças pessoais
5. Dar dicas de organização financeira

## EXEMPLOS DE RESPOSTAS CORRETAS:

Usuário: "Gastei 50 reais no mercado"
✅ Resposta: "Registrei sua despesa de R$ 50,00 em alimentação! 🛒"
<!--ACTION:{"action":"add_transaction","type":"expense","amount":50,"category":"alimentacao","description":"mercado","date":"2025-01-11"}-->

Usuário: "Quanto gastei esse mês?"
✅ Resposta: "Esse mês você gastou R$ 1.234,56 no total. As maiores despesas foram em alimentação (R$ 450) e transporte (R$ 320). 📊"

Usuário: "Apagar a última despesa"
✅ Resposta: "Pronto! Excluí a despesa de R$ 50,00 em alimentação. 🗑️"
<!--ACTION:{"action":"delete_transaction","id":"uuid-aqui"}-->

## REGRAS ADICIONAIS:
- Sempre responda em português brasileiro
- Para valores, interprete como BRL (R$)
- Se não souber a data, use a data de hoje
- Se a categoria não for clara, pergunte ao usuário
- Se o usuário pedir para excluir algo, identifique a transação mais provável no contexto`;

// Safe error mapping - never expose internal details
const getSafeErrorMessage = (error: unknown): string => {
  console.error("Chat error:", error);
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("api_key") || msg.includes("configured")) {
      return "Configuração de serviço incompleta";
    }
  }
  return "Erro ao processar sua mensagem";
};

// Verify JWT and return user ID
const verifyAuth = async (req: Request): Promise<{ userId: string } | { error: Response }> => {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase configuration missing");
    return {
      error: new Response(
        JSON.stringify({ error: "Configuração de serviço incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) {
    console.error("Auth verification failed:", error?.message);
    return {
      error: new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  return { userId: data.user.id };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    
    const { messages, context } = await req.json();
    
    // Validate messages input
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Mensagens inválidas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: "Muitas mensagens no histórico" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !msg.role || !msg.content) {
        return new Response(
          JSON.stringify({ error: "Formato de mensagem inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (typeof msg.content !== 'string' || msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: "Mensagem muito longa" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: "Role de mensagem inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate context size if provided
    if (context) {
      const contextStr = JSON.stringify(context);
      if (contextStr.length > MAX_CONTEXT_SIZE) {
        return new Response(
          JSON.stringify({ error: "Dados de contexto muito grandes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context with user's financial data
    let contextMessage = `\n\n## DADOS FINANCEIROS DO USUÁRIO:
- Saldo atual: R$ ${context?.balance?.toFixed(2) || '0.00'}
- Total de receitas: R$ ${context?.income?.toFixed(2) || '0.00'}
- Total de despesas: R$ ${context?.expenses?.toFixed(2) || '0.00'}
- Data de hoje: ${new Date().toISOString().split('T')[0]}`;

    // Add recent transactions to context
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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione mais créditos na sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: getSafeErrorMessage(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
