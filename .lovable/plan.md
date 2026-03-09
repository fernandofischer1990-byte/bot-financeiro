
## Overview

Transform the existing FinBot chat into a full Financial Copilot by extending the analytics layer, enriching the AI context, upgrading the UI, and updating the system prompt — all without touching the database schema.

---

## What will be built

### 1. `src/lib/financialAnalytics.ts` — New analytics module (pure functions)

Computes everything from the existing `Transaction[]` array:

- `getMonthlyMetrics(txs)` — income/expenses/balance for current calendar month
- `getSavingsRate(income, expenses)` — percentage saved
- `getFinancialHealthScore(txs)` — 0–100 score based on savings rate, spending concentration, income regularity
- `detectSpendingInsights(txs)` — returns an array of insight strings:
  - Spending spike: any category > 20% of monthly income
  - Category concentration: top category > 40% of total expenses
  - Low savings rate: savings < 10%
  - Large single transaction: > 20% of monthly income
- `computeBudgetAwareness()` — returns placeholder message "Orçamento não configurado" (budget table not created yet, but logic stub is ready to extend)

### 2. `src/services/chatService.ts` — Richer `ChatContext` type

Add new fields to the context object sent to the edge function:

```typescript
interface ChatContext {
  balance: number;
  income: number;           // overall total
  expenses: number;         // overall total
  income_month: number;     // current calendar month
  expenses_month: number;   // current calendar month
  savings_rate: number;     // percentage (0–100)
  health_score: number;     // 0–100
  top_categories: { category: string; amount: number }[];
  top_spending_categories?: Record<string, number>;   // kept for compatibility
  recentTransactions: [...]
  insights: string[];       // pre-computed insight strings
  budgets: null;            // placeholder
}
```

### 3. `src/components/chat/ChatInterface.tsx` — Context assembly + auto-insights + UX

**Context assembly** (replaces the existing `topSpendingCategories` memo):
- Compute `income_month`, `expenses_month`, `savings_rate`, `health_score`, `insights`, `top_categories` using the new analytics module.

**Proactive insights on chat open** (auto, as user answered):
- After transactions load and messages are empty, post a synthetic assistant message with the top 2–3 computed insights. This runs once per session using a `useRef` flag so it doesn't repeat on re-renders.

**Quick action buttons** (updated):
- Replace existing 4 buttons with: `Adicionar despesa`, `Adicionar receita`, `/monthly_report`, `Analisar meus gastos`, `Score financeiro`

**Spending alert on transaction confirm**:
- When confirming an `add_transaction`, if `amount > 0.2 * income_month`, prepend a yellow alert banner inside the confirm card: "⚠️ Esta compra representa X% da sua renda mensal."

### 4. `supabase/functions/chat/index.ts` — Upgraded system prompt + richer context

**System prompt additions:**
- New section: `## COPILOT CAPABILITIES` listing analysis commands
- `/monthly_report` command handler: instructions to produce full structured monthly report using context fields
- Spending alert awareness: if amount of a new transaction > 20% of income_month, mention it in the response
- Health score explanation: when asked, use the `health_score` value from context and explain based on savings_rate and category concentration
- Budget awareness: if asked about budget, respond with "Você ainda não configurou orçamentos. Posso ajudá-lo a planejar suas metas!"

**Richer context block in system message:**
```
## DADOS FINANCEIROS DO USUÁRIO:
- Saldo total: R$ X
- Receitas totais: R$ X
- Despesas totais: R$ X
- Receitas do mês atual: R$ X
- Despesas do mês atual: R$ X
- Taxa de poupança: X%
- Score financeiro: X/100
- Top categorias (mês): [list]
- Insights detectados: [list]
```

### 5. `src/components/chat/MessageBubble.tsx` — Markdown rendering

Install `react-markdown` is NOT possible (no package install in plan mode), so instead use a lightweight inline renderer: parse `**bold**`, `*italic*`, bullet lists (`- item`) and `# headers` into appropriate JSX via a simple regex-based transform. This avoids adding dependencies and keeps the bundle lean.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/lib/financialAnalytics.ts` | **NEW** — pure analytics functions |
| `src/services/chatService.ts` | Extend `ChatContext` interface with new fields |
| `src/components/chat/ChatInterface.tsx` | Richer context, proactive insights, spending alert, updated quick actions |
| `src/components/chat/MessageBubble.tsx` | Lightweight inline markdown renderer |
| `supabase/functions/chat/index.ts` | Expanded system prompt + richer context block |

No database migrations. No new tables. No breaking changes.

---

## Data flow diagram

```text
Transaction[] (TransactionsContext)
        |
        v
financialAnalytics.ts
  ├── getMonthlyMetrics()     → income_month, expenses_month
  ├── getSavingsRate()        → savings_rate (%)
  ├── getFinancialHealthScore() → health_score (0-100)
  └── detectSpendingInsights() → insights[]
        |
        v
ChatInterface.tsx
  ├── buildChatContext() → enriched ChatContext
  ├── useEffect: auto-insights on open (once per session)
  └── sendChatMessage(messages, context)
        |
        v
Edge Function: chat/index.ts
  ├── Richer system prompt with /monthly_report, budget awareness, health score
  └── Context block with all new fields → AI response (JSON)
        |
        v
ChatInterface.tsx parser → display message + optional action
```
