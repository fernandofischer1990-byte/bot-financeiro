/**
 * Utilitários HTTP compartilhados pelas edge functions.
 * - CORS unificado com allowlist de origens (A1)
 * - Rate limiting por usuário, janela deslizante em memória (A2)
 */

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/bot-financeiro\.lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/,
];

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extra, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status: number,
  cors: Record<string, string>,
  extra: Record<string, string> = {},
): Response {
  return jsonResponse({ error: message }, status, cors, extra);
}

export function preflight(req: Request, cors: Record<string, string>): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return null;
}

// ---------------------------------------------------------------------------
// Rate limiting (janela deslizante, por instância da function)
// ---------------------------------------------------------------------------

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds = 60,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const oldest = hits[0];
    buckets.set(key, hits);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Limpeza oportunista para não crescer indefinidamente
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

/** Retorna a resposta 429 pronta quando o usuário excedeu o limite, ou null. */
export function enforceRateLimit(
  fnName: string,
  userId: string,
  limit: number,
  cors: Record<string, string>,
  windowSeconds = 60,
): Response | null {
  const result = checkRateLimit(`${fnName}:${userId}`, limit, windowSeconds);
  if (result.allowed) return null;
  return errorResponse(
    `Muitas requisições. Tente novamente em ${result.retryAfterSeconds}s.`,
    429,
    cors,
    { "Retry-After": String(result.retryAfterSeconds) },
  );
}
