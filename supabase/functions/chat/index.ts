import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o FinBot, um assistente financeiro pessoal inteligente e amigável. Você ajuda usuários brasileiros a gerenciar suas finanças.

SUAS CAPACIDADES:
1. Adicionar transações (receitas e despesas)
2. Consultar dados financeiros do usuário
3. Fornecer resumos e insights personalizados
4. Responder perguntas sobre finanças pessoais

CATEGORIAS DE DESPESAS DISPONÍVEIS:
- alimentacao, transporte, moradia, saude, lazer, educacao, vestuario, assinaturas, outros_despesa

CATEGORIAS DE RECEITAS DISPONÍVEIS:
- salario, freelance, investimentos, outros_receita

FORMATO DE RESPOSTA:
Quando o usuário pedir para adicionar uma transação, responda em JSON:
{"action": "add_transaction", "type": "expense|income", "amount": 100.00, "category": "categoria", "description": "descrição", "date": "YYYY-MM-DD"}

Quando for apenas uma consulta ou conversa normal, responda normalmente em texto.

REGRAS:
- Sempre responda em português brasileiro
- Seja educado e prestativo
- Use emojis moderadamente para tornar a conversa agradável
- Para valores monetários, sempre interprete como BRL (R$)
- Se não souber a data, use a data atual
- Se a categoria não for clara, pergunte ao usuário`;

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context with user's financial data
    let contextMessage = "";
    if (context) {
      contextMessage = `\n\nDADOS FINANCEIROS DO USUÁRIO:
- Saldo atual: R$ ${context.balance?.toFixed(2) || '0.00'}
- Total de receitas: R$ ${context.income?.toFixed(2) || '0.00'}
- Total de despesas: R$ ${context.expenses?.toFixed(2) || '0.00'}
- Data de hoje: ${new Date().toISOString().split('T')[0]}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
