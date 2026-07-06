import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser as client } from "../supabase";

export default defineTool({
  name: "delete_transaction",
  title: "Delete transaction",
  description: "Delete one of the signed-in user's transactions by id.",
  inputSchema: {
    id: z.string().uuid().describe("Transaction id to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { error } = await client(ctx)
      .from("transactions")
      .delete()
      .eq("user_id", ctx.getUserId())
      .eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Deleted ${id}` }] };
  },
});
