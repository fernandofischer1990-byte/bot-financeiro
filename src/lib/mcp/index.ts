import { auth, defineMcp } from "@lovable.dev/mcp-js";
import addTransactionTool from "./tools/add-transaction";
import listTransactionsTool from "./tools/list-transactions";
import deleteTransactionTool from "./tools/delete-transaction";
import getFinancialSummaryTool from "./tools/get-financial-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "finbot-mcp",
  title: "FinBot",
  version: "0.1.0",
  instructions:
    "Tools for the FinBot personal finance app. Use `list_transactions` to inspect recent activity, `add_transaction` to record income/expenses/investments (amount is always positive; direction comes from `type`), `delete_transaction` to remove an entry by id, and `get_financial_summary` for aggregated income/expenses/investments over a period. Categories and dates follow the BR conventions used in the app (dates YYYY-MM-DD).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTransactionsTool, addTransactionTool, deleteTransactionTool, getFinancialSummaryTool],
});
