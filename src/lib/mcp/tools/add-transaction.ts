import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser as client } from "../supabase";

export default defineTool({
  name: "add_transaction",
  title: "Add transaction",
  description:
    "Add an income, expense, or investment transaction for the signed-in user. Amount is positive; type distinguishes direction. For investments, provide investment_type and investment_operation.",
  inputSchema: {
    type: z.enum(["income", "expense", "investment"]).describe("Transaction type."),
    amount: z.number().positive().describe("Positive numeric amount in BRL."),
    category: z.string().min(1).describe("Category slug (e.g. alimentacao, transporte, salario, freelance, outros_despesa, outros_receita)."),
    description: z.string().optional().describe("Free-text description."),
    transaction_date: z.string().describe("Date YYYY-MM-DD."),
    institution: z.string().optional().describe("Institution / broker (investments)."),
    investment_type: z
      .enum(["cdb", "tesouro_direto", "acoes", "fii", "criptomoedas", "previdencia", "poupanca", "etf", "renda_fixa", "outros"])
      .optional()
      .describe("Required when type=investment."),
    investment_operation: z
      .enum(["deposit", "withdraw", "yield", "loss"])
      .optional()
      .describe("Required when type=investment."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (input.type === "investment" && (!input.investment_type || !input.investment_operation)) {
      return {
        content: [{ type: "text", text: "investment_type and investment_operation are required for investments" }],
        isError: true,
      };
    }
    const { data, error } = await client(ctx)
      .from("transactions")
      .insert({
        user_id: ctx.getUserId(),
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        transaction_date: input.transaction_date,
        institution: input.institution ?? null,
        investment_type: input.investment_type ?? null,
        investment_operation: input.investment_operation ?? null,
        source: "mcp",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created transaction ${data.id}` }],
      structuredContent: { transaction: data },
    };
  },
});
