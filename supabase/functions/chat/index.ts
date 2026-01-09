import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
