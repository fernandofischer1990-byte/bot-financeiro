import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em extrair transações financeiras de extratos bancários.

Analise o conteúdo do extrato e extraia TODAS as transações encontradas.

Para cada transação, retorne:
- date: data no formato YYYY-MM-DD
- type: "income" para entradas (créditos, recebimentos, TED/PIX recebido) ou "expense" para saídas (débitos, pagamentos, TED/PIX enviado)
- amount: valor numérico positivo (sem símbolos de moeda)
- description: descrição completa da transação como aparece no extrato
- suggestedCategory: categoria sugerida baseada na descrição

Categorias de DESPESA disponíveis:
- alimentacao (supermercados, restaurantes, padarias, iFood, Rappi)
- transporte (Uber, 99, combustível, estacionamento, pedágio)
- moradia (aluguel, condomínio, IPTU, energia, água, gás, internet)
- saude (farmácias, médicos, laboratórios, hospitais, planos de saúde)
- educacao (escolas, cursos, livros, materiais)
- lazer (cinema, streaming, jogos, viagens, hobbies)
- vestuario (roupas, calçados, acessórios)
- assinaturas (Netflix, Spotify, Amazon Prime, academias)
- outros_despesa (boletos, transferências enviadas, outros pagamentos)

Categorias de RECEITA disponíveis:
- salario (salário, pagamento, holerite)
- freelance (trabalhos extras, projetos)
- investimentos (rendimentos, dividendos, juros)
- vendas (venda de produtos)
- outros_receita (PIX/TED recebido, reembolsos, outros)

IMPORTANTE:
- Inclua TODAS as transações, mesmo as pequenas
- Mantenha a descrição original do extrato
- Use o sinal do valor para determinar se é entrada ou saída
- Valores negativos ou débitos são expenses, valores positivos ou créditos são income
- Retorne APENAS JSON válido, sem markdown

Formato de resposta:
{
  "transactions": [
    {
      "date": "2025-01-05",
      "type": "expense",
      "amount": 150.00,
      "description": "PIX ENVIADO - SUPERMERCADO XYZ",
      "suggestedCategory": "alimentacao"
    }
  ],
  "summary": {
    "totalTransactions": 10,
    "totalIncome": 5000.00,
    "totalExpenses": 2000.00
  }
}`;

const MAX_BASE64_SIZE = 5 * 1024 * 1024 * 1.33;
const MAX_TEXT_SIZE = 100000;

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

    const { pdfBase64, pdfText } = await req.json();

    if (pdfBase64 && pdfBase64.length > MAX_BASE64_SIZE) {
      return new Response(JSON.stringify({ error: "PDF muito grande. Tamanho máximo: 5MB" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (pdfText && pdfText.length > MAX_TEXT_SIZE) {
      return new Response(JSON.stringify({ error: "Texto muito longo. Tamanho máximo: 100KB" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!pdfBase64 && !pdfText) {
      return new Response(JSON.stringify({ error: "PDF base64 ou texto é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userContent = pdfText
      ? `Analise o seguinte extrato bancário e extraia todas as transações:\n\n${pdfText}`
      : `Analise o conteúdo deste extrato bancário em PDF (base64) e extraia todas as transações. O PDF está codificado abaixo:\n\n${pdfBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar extrato. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Não foi possível processar este extrato. Tente outro formato." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Formato de resposta inválido. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(parsedContent), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Parse statement error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar solicitação" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
