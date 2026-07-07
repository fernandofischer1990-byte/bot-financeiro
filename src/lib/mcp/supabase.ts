import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// Read env lazily inside the factory. Use Deno.env in the edge runtime;
// fall back to process.env only for local Node-based tooling.
function getEnv(name: string): string {
  // deno-lint-ignore no-explicit-any
  const g: any = globalThis as any;
  const denoVal = g?.Deno?.env?.get?.(name);
  if (denoVal) return denoVal;
  const procVal = g?.process?.env?.[name];
  if (procVal) return procVal;
  throw new Error(`Missing env ${name}`);
}

export function supabaseForUser(ctx: ToolContext) {
  const url = getEnv("SUPABASE_URL");
  // Edge Functions inject SUPABASE_ANON_KEY by default; PUBLISHABLE_KEY is not guaranteed.
  let key: string;
  try {
    key = getEnv("SUPABASE_ANON_KEY");
  } catch {
    key = getEnv("SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
