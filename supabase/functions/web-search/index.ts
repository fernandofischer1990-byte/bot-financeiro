import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });
const fmtPct = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const nowStamp = () =>
  new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_paulo" });

// ----- External data providers -----

async function fetchFx(pair: string): Promise<string | null> {
  // pair like USD-BRL, EUR-BRL, GBP-BRL
  try {
    const r = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`);
    if (!r.ok) return null;
    const j = await r.json();
    const key = pair.replace("-", "");
    const d = j?.[key];
    if (!d) return null;
    const bid = Number(d.bid);
    const pct = Number(d.pctChange);
    const name = d.name || pair;
    return `**${name}**\nCotação atual: ${fmtBRL(bid)}\nVariação no dia: ${pct >= 0 ? "+" : ""}${fmtPct(pct)}\nFonte: AwesomeAPI (média de mercado) — consultado em ${nowStamp()}.`;
  } catch {
    return null;
  }
}

async function fetchBcbSerie(codigo: number, label: string, unit = "% a.a."): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const last = Array.isArray(j) ? j[j.length - 1] : null;
    if (!last) return null;
    return `**${label}**\nValor atual: ${last.valor}${unit ? ` ${unit}` : ""}\nReferência: ${last.data}\nFonte: Banco Central do Brasil (SGS ${codigo}) — consultado em ${nowStamp()}.`;
  } catch {
    return null;
  }
}

async function fetchCrypto(ids: string[], names: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=brl,usd&include_24hr_change=true`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const lines: string[] = [];
    for (const id of ids) {
      const d = j[id];
      if (!d) continue;
      lines.push(
        `**${names[id] || id}**\n- BRL: ${fmtBRL(Number(d.brl))}\n- USD: US$ ${Number(d.usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}\n- Variação 24h: ${(d.brl_24h_change ?? 0).toFixed(2)}%`,
      );
    }
    if (!lines.length) return null;
    return `${lines.join("\n\n")}\n\nFonte: CoinGecko — consultado em ${nowStamp()}.`;
  } catch {
    return null;
  }
}

// ----- Routing -----

async function routeQuery(query: string): Promise<string | null> {
  const q = query.toLowerCase();

  // FX
  const fxParts: string[] = [];
  if (/\b(d[óo]lar|usd)\b/.test(q)) fxParts.push(await fetchFx("USD-BRL") || "");
  if (/\b(euro|eur)\b/.test(q)) fxParts.push(await fetchFx("EUR-BRL") || "");
  if (/\b(libra|gbp)\b/.test(q)) fxParts.push(await fetchFx("GBP-BRL") || "");

  // Crypto
  const cryptoIds: string[] = [];
  const cryptoNames: Record<string, string> = {};
  if (/\b(bitcoin|btc)\b/.test(q)) { cryptoIds.push("bitcoin"); cryptoNames.bitcoin = "Bitcoin (BTC)"; }
  if (/\b(ethereum|eth)\b/.test(q)) { cryptoIds.push("ethereum"); cryptoNames.ethereum = "Ethereum (ETH)"; }
  if (/\bsolana|sol\b/.test(q)) { cryptoIds.push("solana"); cryptoNames.solana = "Solana (SOL)"; }
  const cryptoBlock = cryptoIds.length ? await fetchCrypto(cryptoIds, cryptoNames) : null;

  // BCB economic indicators
  const bcbParts: string[] = [];
  if (/\bselic\b/.test(q)) bcbParts.push(await fetchBcbSerie(432, "Taxa SELIC Meta") || "");
  if (/\bcdi\b/.test(q)) bcbParts.push(await fetchBcbSerie(12, "Taxa CDI", "% a.d.") || "");
  if (/\b(ipca|infla[cç][ãa]o)\b/.test(q)) bcbParts.push(await fetchBcbSerie(433, "IPCA (variação mensal)", "%") || "");

  const blocks = [...fxParts, ...bcbParts, cryptoBlock].filter(Boolean) as string[];
  return blocks.length ? blocks.join("\n\n---\n\n") : null;
}

// ----- Fallback via LLM (no knowledge-cutoff claims) -----

async function llmFallback(query: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = `Você é um assistente de pesquisa financeira para o Brasil.

REGRAS CRÍTICAS:
- A data de hoje é ${today}. Sempre considere essa data como referência.
- NUNCA mencione "knowledge cutoff", "base de conhecimento até 2024", "meu sistema acompanha o mercado em tempo real de 2024" ou qualquer ano específico do seu treinamento.
- Se você não tem certeza sobre um valor atualizado (cotações, taxas, preços ao vivo), responda exatamente:
  "Não consegui consultar uma fonte atualizada neste momento. Tente novamente em alguns instantes."
- Nunca invente valores. Nunca cite cotações específicas sem fonte verificada.
- Para definições, conceitos e explicações (que não dependem de data), responda normalmente de forma factual e concisa (máx 200 palavras).`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      stream: false,
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("rate_limit");
    if (res.status === 402) throw new Error("payment_required");
    throw new Error("ai_error");
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.length > 500) {
      return new Response(JSON.stringify({ error: "Query inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[web-search] query:", query);

    // 1) Try real-time providers first
    const live = await routeQuery(query);
    if (live) {
      console.log("[web-search] live source matched");
      return new Response(JSON.stringify({ result: live, source: "live" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Fallback to LLM with strict no-cutoff instructions
    try {
      const result = await llmFallback(query);
      return new Response(JSON.stringify({ result, source: "llm" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ai_error";
      if (msg === "rate_limit") {
        return new Response(JSON.stringify({ error: "Rate limit excedido" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg === "payment_required") {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ result: "Não consegui consultar uma fonte atualizada neste momento. Tente novamente em alguns instantes.", source: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    console.error("web-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
