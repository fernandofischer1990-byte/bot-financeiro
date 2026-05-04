import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPENSE_CATS = ['alimentacao', 'transporte', 'moradia', 'saude', 'lazer', 'educacao', 'vestuario', 'assinaturas', 'outros_despesa'];
const INCOME_CATS = ['salario', 'freelance', 'investimentos', 'vendas', 'outros_receita'];

const SYSTEM_PROMPT = `Você é um classificador de transações financeiras brasileiras. Para cada transação recebida (com índice, descrição e tipo), retorne EXATAMENTE uma categoria da lista permitida, baseada na descrição.

Categorias de DESPESA (use quando type="expense"):
- alimentacao: supermercados, restaurantes, padarias, iFood, Rappi, mercados, lanchonetes, cafés
- transporte: Uber, 99, combustível, postos, estacionamento, pedágio, metrô, ônibus, passagens
- moradia: aluguel, condomínio, IPTU, energia (Enel, CPFL, Cemig), água (Sabesp, Copasa), gás, internet (Claro, Vivo, Tim, Oi, Net)
- saude: farmácias (Raia, Pacheco, Drogasil), médicos, laboratórios, hospitais, planos de saúde (Unimed, Amil), odontologia
- educacao: escolas, faculdades, cursos (Udemy, Alura), livros, papelarias
- lazer: cinema, streaming de vídeo, jogos, viagens, hotéis, Booking, Airbnb, ingressos, parques
- vestuario: roupas, calçados (Renner, C&A, Zara, Nike, Adidas, Centauro)
- assinaturas: Netflix, Spotify, Prime Video, Disney+, HBO, academias (Smart Fit), Game Pass
- outros_despesa: PIX/TED enviado genérico, boletos diversos, tarifas bancárias, IOF

Categorias de RECEITA (use quando type="income"):
- salario: salário, holerite, folha de pagamento, 13º, férias, PLR, bônus
- freelance: serviços prestados, consultoria, projetos, NF-e
- investimentos: rendimentos, dividendos, JCP, juros, FII, tesouro, CDB, aplicações
- vendas: venda de produtos, Mercado Livre, OLX, Shopee
- outros_receita: PIX/TED recebido genérico, reembolsos, devoluções, estornos, cashback

REGRAS:
- Sempre escolha a categoria mais específica possível
- Se descrição vazia ou ambígua, use 'outros_despesa' ou 'outros_receita' conforme o tipo
- NUNCA invente categorias fora das listas
- Sempre respeite o tipo: despesas só recebem categorias de despesa, receitas só de receita`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const items = body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (items.length > 200) {
      return new Response(JSON.stringify({ error: "Máximo 200 itens por chamada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sanitize items
    const sanitized = items.map((it: any, i: number) => ({
      index: typeof it.index === 'number' ? it.index : i,
      description: String(it.description || '').slice(0, 200),
      type: it.type === 'income' ? 'income' : 'expense',
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuração de IA ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userMsg = `Classifique as seguintes transações:\n\n${JSON.stringify(sanitized, null, 2)}\n\nRetorne via tool call.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_categories",
            description: "Retorna a categoria classificada para cada transação",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      category: { type: "string", enum: [...EXPENSE_CATS, ...INCOME_CATS] },
                    },
                    required: ["index", "category"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_categories" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao chamar IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta de IA inválida" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let parsed: { results: { index: number; category: string }[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido da IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate categories match the transaction type
    const typeByIndex = new Map(sanitized.map((s) => [s.index, s.type]));
    const validResults = (parsed.results || []).filter((r) => {
      const t = typeByIndex.get(r.index);
      if (t === 'expense') return EXPENSE_CATS.includes(r.category);
      if (t === 'income') return INCOME_CATS.includes(r.category);
      return false;
    });

    return new Response(JSON.stringify({ results: validResults }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("categorize-transactions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
