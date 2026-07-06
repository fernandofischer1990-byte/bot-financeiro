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
  name: "get_financial_summary",
  title: "Get financial summary",
  description:
    "Aggregate the signed-in user's income, expenses, investments and net balance across an optional date range.",
  inputSchema: {
    from: z.string().optional().describe("Start date inclusive, YYYY-MM-DD."),
    to: z.string().optional().describe("End date inclusive, YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = client(ctx)
      .from("transactions")
      .select("type, amount, category, investment_operation")
      .eq("user_id", ctx.getUserId());
    if (from) q = q.gte("transaction_date", from);
    if (to) q = q.lte("transaction_date", to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    let income = 0;
    let expenses = 0;
    const inv = { deposits: 0, withdraws: 0, yields: 0, losses: 0 };
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      if (r.type === "income") {
        income += amt;
      } else if (r.type === "expense") {
        expenses += amt;
        byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
      } else if (r.type === "investment") {
        if (r.investment_operation === "deposit") inv.deposits += amt;
        else if (r.investment_operation === "withdraw") inv.withdraws += amt;
        else if (r.investment_operation === "yield") inv.yields += amt;
        else if (r.investment_operation === "loss") inv.losses += amt;
      }
    }

    const summary = {
      period: { from: from ?? null, to: to ?? null },
      income,
      expenses,
      net: income - expenses,
      investments: inv,
      expenses_by_category: byCategory,
      transaction_count: rows.length,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
