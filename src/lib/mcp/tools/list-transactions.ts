import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_transactions",
  title: "List transactions",
  description:
    "List the signed-in user's financial transactions (income, expense, investment), most recent first. Optionally filter by type, category, or date range (YYYY-MM-DD).",
  inputSchema: {
    type: z.enum(["income", "expense", "investment"]).optional().describe("Filter by transaction type."),
    category: z.string().optional().describe("Filter by category slug (e.g. alimentacao, salario)."),
    from: z.string().optional().describe("Start date inclusive, YYYY-MM-DD."),
    to: z.string().optional().describe("End date inclusive, YYYY-MM-DD."),
    limit: z.number().int().positive().max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, category, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = client(ctx)
      .from("transactions")
      .select("id, type, amount, category, description, transaction_date, institution, investment_type, investment_operation")
      .eq("user_id", ctx.getUserId())
      .order("transaction_date", { ascending: false })
      .limit(limit ?? 50);
    if (type) q = q.eq("type", type);
    if (category) q = q.eq("category", category);
    if (from) q = q.gte("transaction_date", from);
    if (to) q = q.lte("transaction_date", to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
