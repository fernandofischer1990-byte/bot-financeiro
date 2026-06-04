import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const nowStamp = () =>
  new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });
const fmtNum = (n: number, max = 4) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: max });
const fmtPct = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

// =====================================================================
// CURRENCY CATALOG (ISO 4217)
// =====================================================================
interface CurrencyDefinition {
  code: string;
  name: string;
  aliases: string[]; // lowercased aliases (and the code lowercased)
}

const CURRENCIES: CurrencyDefinition[] = [
  // Americas
  { code: "BRL", name: "Real Brasileiro", aliases: ["brl", "real", "reais", "real brasileiro"] },
  // For PT-BR users, bare "dolar"/"libra" default to USD/GBP. Variants stay explicit.
  { code: "USD", name: "Dólar Americano", aliases: ["usd", "dolar", "dolares", "dolar americano", "dolares americanos", "us dollar", "dolar dos eua"] },
  { code: "CAD", name: "Dólar Canadense", aliases: ["cad", "dolar canadense", "dolar canadiano"] },
  { code: "MXN", name: "Peso Mexicano", aliases: ["mxn", "peso mexicano", "pesos mexicanos"] },
  { code: "ARS", name: "Peso Argentino", aliases: ["ars", "peso argentino", "pesos argentinos"] },
  { code: "CLP", name: "Peso Chileno", aliases: ["clp", "peso chileno", "pesos chilenos"] },
  { code: "COP", name: "Peso Colombiano", aliases: ["cop", "peso colombiano", "pesos colombianos"] },
  { code: "PEN", name: "Sol Peruano", aliases: ["pen", "sol peruano", "soles peruanos", "novo sol"] },
  { code: "UYU", name: "Peso Uruguaio", aliases: ["uyu", "peso uruguaio", "pesos uruguaios"] },
  { code: "PYG", name: "Guarani Paraguaio", aliases: ["pyg", "guarani", "guarani paraguaio"] },
  { code: "BOB", name: "Boliviano", aliases: ["bob", "boliviano", "bolivianos"] },
  // Europe
  { code: "EUR", name: "Euro", aliases: ["eur", "euro", "euros"] },
  { code: "GBP", name: "Libra Esterlina", aliases: ["gbp", "libra", "libras", "libra esterlina", "libras esterlinas", "esterlina"] },
  { code: "CHF", name: "Franco Suíço", aliases: ["chf", "franco suico", "francos suicos", "franco"] },
  { code: "NOK", name: "Coroa Norueguesa", aliases: ["nok", "coroa norueguesa", "coroas norueguesas"] },
  { code: "SEK", name: "Coroa Sueca", aliases: ["sek", "coroa sueca", "coroas suecas"] },
  { code: "DKK", name: "Coroa Dinamarquesa", aliases: ["dkk", "coroa dinamarquesa", "coroas dinamarquesas"] },
  { code: "PLN", name: "Zloty Polonês", aliases: ["pln", "zloty", "zloty polones"] },
  { code: "CZK", name: "Coroa Tcheca", aliases: ["czk", "coroa tcheca", "coroa checa"] },
  { code: "HUF", name: "Forint Húngaro", aliases: ["huf", "forint", "forint hungaro"] },
  { code: "RON", name: "Leu Romeno", aliases: ["ron", "leu", "leu romeno"] },
  // Asia
  { code: "JPY", name: "Iene Japonês", aliases: ["jpy", "iene", "ienes", "yen", "iene japones"] },
  { code: "CNY", name: "Yuan Chinês", aliases: ["cny", "yuan", "yuan chines", "renminbi", "rmb"] },
  { code: "HKD", name: "Dólar de Hong Kong", aliases: ["hkd", "dolar de hong kong", "dolar hong kong"] },
  { code: "SGD", name: "Dólar de Singapura", aliases: ["sgd", "dolar de singapura", "dolar singapura"] },
  { code: "KRW", name: "Won Sul-Coreano", aliases: ["krw", "won", "won sul coreano"] },
  { code: "INR", name: "Rúpia Indiana", aliases: ["inr", "rupia indiana"] },
  { code: "THB", name: "Baht Tailandês", aliases: ["thb", "baht", "baht tailandes"] },
  { code: "MYR", name: "Ringgit Malaio", aliases: ["myr", "ringgit", "ringgit malaio"] },
  { code: "IDR", name: "Rupia Indonésia", aliases: ["idr", "rupia indonesia"] },
  { code: "PHP", name: "Peso Filipino", aliases: ["php", "peso filipino", "pesos filipinos"] },
  // Middle East
  { code: "AED", name: "Dirham dos Emirados", aliases: ["aed", "dirham dos emirados", "dirham emirados"] },
  { code: "SAR", name: "Riyal Saudita", aliases: ["sar", "rial saudita", "riyal saudita"] },
  { code: "ILS", name: "Novo Shekel Israelense", aliases: ["ils", "shekel", "novo shekel", "shekel israelense"] },
  { code: "QAR", name: "Rial Catariano", aliases: ["qar", "rial catariano", "riyal catariano", "rial qatar"] },
  { code: "KWD", name: "Dinar Kuwaitiano", aliases: ["kwd", "dinar", "dinar kuwaitiano"] },
  // Oceania
  { code: "AUD", name: "Dólar Australiano", aliases: ["aud", "dolar australiano"] },
  { code: "NZD", name: "Dólar Neozelandês", aliases: ["nzd", "dolar neozelandes", "dolar da nova zelandia"] },
  // Africa
  { code: "ZAR", name: "Rand Sul-Africano", aliases: ["zar", "rand", "rand sul africano"] },
  { code: "EGP", name: "Libra Egípcia", aliases: ["egp", "libra egipcia"] },
  { code: "MAD", name: "Dirham Marroquino", aliases: ["mad", "dirham marroquino"] },
];

// Bare ambiguous words → if the user types only these (no qualifier), ask which currency.
// Note: "dolar/libra/peso" sozinhos NÃO devem cair em USD/GBP automaticamente.
const AMBIGUOUS_BARE: Record<string, string[]> = {
  "dolar": ["USD", "CAD", "AUD", "NZD", "HKD", "SGD"],
  "dolares": ["USD", "CAD", "AUD", "NZD", "HKD", "SGD"],
  "libra": ["GBP", "EGP"],
  "libras": ["GBP", "EGP"],
  "peso": ["ARS", "CLP", "COP", "MXN", "UYU", "PHP"],
  "pesos": ["ARS", "CLP", "COP", "MXN", "UYU", "PHP"],
  "coroa": ["NOK", "SEK", "DKK", "CZK"],
  "coroas": ["NOK", "SEK", "DKK", "CZK"],
  "rupia": ["INR", "IDR"],
  "sol": ["PEN"], // single — resolves directly
};

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

// Strip accents and lowercase
function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// =====================================================================
// CURRENCY DETECTION (returns matches with ambiguity awareness)
// =====================================================================
interface CurrencyMatch {
  code: string;
  alias: string;
  start: number;
  end: number;
  amount?: number;
}

interface DetectionResult {
  matches: CurrencyMatch[];
  ambiguous: { alias: string; codes: string[] }[];
}

// Pre-compute alias index sorted by length desc so we match longer phrases first
interface AliasEntry { alias: string; code: string; }
const ALIAS_INDEX: AliasEntry[] = (() => {
  const arr: AliasEntry[] = [];
  for (const c of CURRENCIES) for (const a of c.aliases) arr.push({ alias: norm(a), code: c.code });
  // Inject bare ambiguous tokens so they get matched and surfaced.
  for (const [bare, codes] of Object.entries(AMBIGUOUS_BARE)) {
    for (const code of codes) arr.push({ alias: norm(bare), code });
  }
  arr.sort((a, b) => b.alias.length - a.alias.length);
  return arr;
})();

// Group aliases that map to multiple codes (e.g. "peso", "libra", "dolar", "rial")
const ALIAS_TO_CODES = (() => {
  const m = new Map<string, Set<string>>();
  for (const e of ALIAS_INDEX) {
    if (!m.has(e.alias)) m.set(e.alias, new Set());
    m.get(e.alias)!.add(e.code);
  }
  return m;
})();

function detectCurrencies(query: string): DetectionResult {
  const text = norm(query);
  const matches: CurrencyMatch[] = [];
  const ambiguous: { alias: string; codes: string[] }[] = [];
  const taken: boolean[] = new Array(text.length).fill(false);

  for (const { alias } of ALIAS_INDEX) {
    if (alias.length < 2) continue;
    // word boundary search: scan all positions
    let from = 0;
    while (from <= text.length - alias.length) {
      const idx = text.indexOf(alias, from);
      if (idx === -1) break;
      const before = idx === 0 ? " " : text[idx - 1];
      const after = idx + alias.length >= text.length ? " " : text[idx + alias.length];
      const isBoundary = !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
      const overlaps = taken.slice(idx, idx + alias.length).some(Boolean);
      if (isBoundary && !overlaps) {
        for (let i = idx; i < idx + alias.length; i++) taken[i] = true;
        const codes = Array.from(ALIAS_TO_CODES.get(alias) || []);
        if (codes.length === 1) {
          matches.push({ code: codes[0], alias, start: idx, end: idx + alias.length });
        } else {
          // Ambiguous — record once
          if (!ambiguous.find((a) => a.alias === alias)) {
            ambiguous.push({ alias, codes });
          }
        }
      }
      from = idx + alias.length;
    }
  }

  // Attach amount immediately preceding each match (e.g. "100 dolares", "1.500,50 euros")
  for (const m of matches) {
    const segment = text.slice(0, m.start).trimEnd();
    const numMatch = segment.match(/([\d.,]+)\s*$/);
    if (numMatch) {
      const raw = numMatch[1];
      // Brazilian-style: dot=thousand, comma=decimal. Also accept plain "100".
      let normNum = raw;
      if (raw.includes(",")) {
        normNum = raw.replace(/\./g, "").replace(",", ".");
      } else if ((raw.match(/\./g) || []).length > 1) {
        normNum = raw.replace(/\./g, "");
      }
      const n = Number(normNum);
      if (Number.isFinite(n) && n > 0) m.amount = n;
    }
  }

  return { matches, ambiguous };
}

// =====================================================================
// EXCHANGE-RATE PROVIDERS (with fallback chain)
// =====================================================================
interface RateResult {
  rate: number;        // 1 from = rate to
  source: string;
  reference?: string;  // date label
}

// In-memory cache (5 min TTL)
interface CacheEntry { value: RateResult; expires: number; }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;
const cacheKey = (a: string, b: string) => `${a}->${b}`;
function cacheGet(a: string, b: string): RateResult | null {
  const e = CACHE.get(cacheKey(a, b));
  if (e && e.expires > Date.now()) return e.value;
  if (e) CACHE.delete(cacheKey(a, b));
  return null;
}
function cacheSet(a: string, b: string, v: RateResult) {
  CACHE.set(cacheKey(a, b), { value: v, expires: Date.now() + TTL_MS });
}

async function safeFetchJson(url: string, timeoutMs = 5000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "FinBot/1.0" } });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// --- Provider 1: AwesomeAPI (intraday, supports many pairs to BRL and crosses) ---
async function provAwesome(from: string, to: string): Promise<RateResult | null> {
  const j = await safeFetchJson(`https://economia.awesomeapi.com.br/json/last/${from}-${to}`);
  const key = `${from}${to}`;
  const d = j?.[key];
  if (!d) return null;
  const rate = Number(d.bid);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, source: "AwesomeAPI", reference: d.create_date || d.timestamp };
}

// --- Provider 2: BCB PTAX (official Banco Central; only some currencies) ---
async function provBcbPtax(from: string, to: string): Promise<RateResult | null> {
  // PTAX is from foreign currency to BRL; supports common majors.
  if (to !== "BRL") return null;
  // try last 7 days backwards
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dataStr = `${mm}-${dd}-${d.getFullYear()}`;
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${from}'&@dataCotacao='${dataStr}'&$format=json`;
    const j = await safeFetchJson(url);
    const row = j?.value?.[0];
    if (row?.cotacaoVenda) {
      return {
        rate: Number(row.cotacaoVenda),
        source: "Banco Central do Brasil (PTAX)",
        reference: row.dataHoraCotacao,
      };
    }
  }
  return null;
}

// --- Provider 3: open.er-api.com (free, no key) ---
async function provErApi(from: string, to: string): Promise<RateResult | null> {
  const j = await safeFetchJson(`https://open.er-api.com/v6/latest/${from}`);
  if (j?.result !== "success") return null;
  const rate = Number(j?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, source: "ExchangeRate API (open.er-api)", reference: j.time_last_update_utc };
}

// --- Provider 4: exchangerate.host (free, no key) ---
async function provExchangerateHost(from: string, to: string): Promise<RateResult | null> {
  const j = await safeFetchJson(`https://api.exchangerate.host/convert?from=${from}&to=${to}`);
  const rate = Number(j?.result);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, source: "exchangerate.host", reference: j?.date };
}

const PROVIDERS = [provBcbPtax, provAwesome, provErApi, provExchangerateHost];

async function getRate(from: string, to: string): Promise<RateResult | { error: string; tried: string[] }> {
  if (from === to) return { rate: 1, source: "identity" };
  const cached = cacheGet(from, to);
  if (cached) return cached;
  const tried: string[] = [];
  for (const p of PROVIDERS) {
    const name = p.name.replace(/^prov/, "");
    tried.push(name);
    try {
      const r = await p(from, to);
      if (r) { cacheSet(from, to, r); return r; }
    } catch (e) {
      console.log(`[web-search] provider ${name} threw:`, e);
    }
  }
  return { error: "no_source", tried };
}

// =====================================================================
// FORMATTING
// =====================================================================
function curName(code: string): string {
  return BY_CODE.get(code)?.name || code;
}

function formatRateBlock(from: string, to: string, res: RateResult): string {
  const fromName = curName(from);
  const toName = curName(to);
  const valueLine = to === "BRL"
    ? `1 ${from} = ${fmtBRL(res.rate)}`
    : `1 ${from} = ${fmtNum(res.rate)} ${to}`;
  const refLine = res.reference ? `Referência: ${res.reference}` : "";
  return [
    `**${fromName} (${from}) → ${toName} (${to})**`,
    valueLine,
    refLine,
    `Consulta realizada: ${nowStamp()}`,
    `Fonte: ${res.source}`,
  ].filter(Boolean).join("\n");
}

function formatConversionBlock(amount: number, from: string, to: string, res: RateResult): string {
  const converted = amount * res.rate;
  const fromName = curName(from);
  const toName = curName(to);
  const convertedLine = to === "BRL"
    ? `${fmtNum(amount)} ${from} = ${fmtBRL(converted)}`
    : `${fmtNum(amount)} ${from} = ${fmtNum(converted)} ${to}`;
  const rateLine = to === "BRL"
    ? `Cotação utilizada: 1 ${from} = ${fmtBRL(res.rate)}`
    : `Cotação utilizada: 1 ${from} = ${fmtNum(res.rate)} ${to}`;
  return [
    `**Conversão ${fromName} → ${toName}**`,
    convertedLine,
    rateLine,
    res.reference ? `Referência: ${res.reference}` : "",
    `Consulta realizada: ${nowStamp()}`,
    `Fonte: ${res.source}`,
  ].filter(Boolean).join("\n");
}

function formatAmbiguity(alias: string, codes: string[]): string {
  const items = codes.map((c) => `• ${curName(c)} (${c})`).join("\n");
  return `Encontrei mais de uma moeda para **"${alias}"**. Qual você deseja consultar?\n\n${items}`;
}

function formatNoSource(from: string, to: string, tried: string[]): string {
  return [
    `Não foi possível consultar uma cotação atualizada para ${from} → ${to} neste momento.`,
    ``,
    `Fontes consultadas:`,
    ...tried.map((t) => `• ${t}`),
    ``,
    `Tente novamente em alguns minutos.`,
  ].join("\n");
}

// =====================================================================
// CURRENCY QUERY HANDLER
// =====================================================================
async function handleCurrencyQuery(query: string): Promise<string | null> {
  const det = detectCurrencies(query);

  // If there's an unresolved ambiguity AND no other clear FX intent, ask
  if (det.matches.length === 0 && det.ambiguous.length > 0) {
    const a = det.ambiguous[0];
    return formatAmbiguity(a.alias, a.codes);
  }

  if (det.matches.length === 0) return null; // not a currency question

  // Conversion intent: at least one match has amount, OR query contains "em" / "para" / "->"
  const conversionWord = /\b(em|para|to|->)\b/.test(norm(query));
  const withAmount = det.matches.find((m) => m.amount !== undefined);

  // Case A: explicit conversion "100 X em Y"
  if (withAmount) {
    const from = withAmount.code;
    // pick target: another matched currency that's not 'from', else BRL
    const target = det.matches.find((m) => m.code !== from)?.code || "BRL";
    const res = await getRate(from, target);
    if ("error" in res) return formatNoSource(from, target, res.tried);
    return formatConversionBlock(withAmount.amount!, from, target, res);
  }

  // Case B: "X em Y" without amount → show rate
  if (conversionWord && det.matches.length >= 2) {
    const from = det.matches[0].code;
    const to = det.matches[1].code;
    const res = await getRate(from, to);
    if ("error" in res) return formatNoSource(from, to, res.tried);
    return formatRateBlock(from, to, res);
  }

  // Case C: simple quote(s) — show each vs BRL (or vs USD if BRL is the asked one)
  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const m of det.matches) {
    if (seen.has(m.code)) continue;
    seen.add(m.code);
    const to = m.code === "BRL" ? "USD" : "BRL";
    const res = await getRate(m.code, to);
    if ("error" in res) {
      blocks.push(formatNoSource(m.code, to, res.tried));
    } else {
      blocks.push(formatRateBlock(m.code, to, res));
    }
  }

  // Append a hint about residual ambiguities (e.g. "peso" not resolved)
  if (det.ambiguous.length > 0) {
    const a = det.ambiguous[0];
    blocks.push(formatAmbiguity(a.alias, a.codes));
  }

  return blocks.length ? blocks.join("\n\n---\n\n") : null;
}

// =====================================================================
// OTHER PROVIDERS (crypto, BCB indicators, B3 stocks)
// =====================================================================
async function fetchCrypto(ids: string[], names: Record<string, string>): Promise<string | null> {
  const j = await safeFetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=brl,usd&include_24hr_change=true`,
  );
  if (!j) return null;
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
}

async function fetchBcbSerie(codigo: number, label: string, unit = "% a.a."): Promise<string | null> {
  const j = await safeFetchJson(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`);
  const last = Array.isArray(j) ? j[j.length - 1] : null;
  if (!last) return null;
  return `**${label}**\nValor atual: ${last.valor}${unit ? ` ${unit}` : ""}\nReferência: ${last.data}\nFonte: Banco Central do Brasil (SGS ${codigo}) — consultado em ${nowStamp()}.`;
}

async function fetchStocks(tickers: string[]): Promise<string | null> {
  const j = await safeFetchJson(`https://brapi.dev/api/quote/${tickers.join(",")}`);
  const results = Array.isArray(j?.results) ? j.results : [];
  if (!results.length) return null;
  const lines = results.map((s: any) =>
    `**${s.symbol}**${s.longName ? ` — ${s.longName}` : ""}\nPreço: ${fmtBRL(Number(s.regularMarketPrice))}\nVariação no dia: ${(s.regularMarketChangePercent ?? 0).toFixed(2)}%`,
  );
  return `${lines.join("\n\n")}\n\nFonte: brapi.dev (B3) — consultado em ${nowStamp()}.`;
}

// =====================================================================
// ROUTER
// =====================================================================
async function routeQuery(query: string): Promise<string | null> {
  const q = norm(query);
  const blocks: string[] = [];

  // 1) Currency / FX (universal)
  const fx = await handleCurrencyQuery(query);
  if (fx) blocks.push(fx);

  // 2) Crypto
  const cryptoIds: string[] = [];
  const cryptoNames: Record<string, string> = {};
  if (/\b(bitcoin|btc)\b/.test(q)) { cryptoIds.push("bitcoin"); cryptoNames.bitcoin = "Bitcoin (BTC)"; }
  if (/\b(ethereum|eth)\b/.test(q)) { cryptoIds.push("ethereum"); cryptoNames.ethereum = "Ethereum (ETH)"; }
  if (/\b(solana|sol)\b/.test(q)) { cryptoIds.push("solana"); cryptoNames.solana = "Solana (SOL)"; }
  if (cryptoIds.length) {
    const c = await fetchCrypto(cryptoIds, cryptoNames);
    if (c) blocks.push(c);
  }

  // 3) BCB economic indicators
  if (/\bselic\b/.test(q)) { const r = await fetchBcbSerie(432, "Taxa SELIC Meta"); if (r) blocks.push(r); }
  if (/\bcdi\b/.test(q)) { const r = await fetchBcbSerie(12, "Taxa CDI", "% a.d."); if (r) blocks.push(r); }
  if (/\b(ipca|inflacao)\b/.test(q)) { const r = await fetchBcbSerie(433, "IPCA (variação mensal)", "%"); if (r) blocks.push(r); }

  // 4) B3 stocks / ETFs / FIIs
  const tickers = Array.from(new Set(
    Array.from(query.toUpperCase().matchAll(/\b([A-Z]{4}[0-9]{1,2})\b/g)).map((m) => m[1]),
  ));
  if (tickers.length) {
    const s = await fetchStocks(tickers);
    if (s) blocks.push(s);
  }

  return blocks.length ? blocks.join("\n\n---\n\n") : null;
}

// =====================================================================
// FALLBACK (LLM, strict no-cutoff)
// =====================================================================
async function llmFallback(query: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = `Você é um assistente de pesquisa financeira para o Brasil.

REGRAS CRÍTICAS:
- A data de hoje é ${today}. Sempre considere essa data como referência.
- NUNCA mencione "knowledge cutoff", "base até 2024" ou qualquer ano do seu treinamento.
- Se você não tem certeza sobre um valor atualizado, responda exatamente:
  "Não consegui consultar uma fonte atualizada neste momento. Tente novamente em alguns instantes."
- Nunca invente valores. Respostas conceituais: máx 200 palavras.`;
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

// =====================================================================
// HTTP entrypoint
// =====================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.length > 500) {
      return new Response(JSON.stringify({ error: "Query inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[web-search] query:", query);

    const live = await routeQuery(query);
    if (live) {
      return new Response(JSON.stringify({ result: live, source: "live" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
