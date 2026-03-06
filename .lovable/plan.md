

# Full Architecture & Stability Audit Report

## PART 1 — Global Architecture Analysis

**Architecture compliance is GOOD overall.** The layered pattern (UI → Context/Hooks → Services → Supabase) is followed correctly.

| Check | Status |
|-------|--------|
| Supabase calls restricted to `/services` | PASS (with 1 exception) |
| Components never query directly | PASS |
| Auth controlled by AuthProvider | PASS |
| Hooks only consume state | PASS |

**Issue #1 — `fileParsingService.ts` calls `supabase.functions.invoke` directly** (line 32)
- **Severity:** LOW
- This is acceptable — it's a service file calling Supabase. No violation.

**No architecture violations found.** All Supabase access is in service files. Components consume context/hooks only.

---

## PART 2 — Transactions System Audit

| Check | Status |
|-------|--------|
| Fetched only once on session load | PASS — `fetchingRef` prevents duplicates |
| Inserts update local state immediately | PASS — optimistic updates in all mutation handlers |
| Metrics computed with `useMemo` | PASS — `useMemo(() => calculateMetrics(...), [deps])` |
| No unnecessary re-fetch after inserts | PASS — local state updated, no refetch |

**Issue #2 — `fetchTransactions` recreated on every render when `hasLoadedOnce` changes**
- **Severity:** MEDIUM
- **File:** `src/contexts/TransactionsContext.tsx:157`
- `useCallback` depends on `[user, authLoading, hasLoadedOnce]`. When `hasLoadedOnce` flips from `false` to `true`, `fetchTransactions` reference changes, which triggers the `useEffect` on line 284-289 again. However, `fetchingRef` prevents a duplicate fetch, so this is **safe but wasteful** — it causes an unnecessary effect invocation.
- **Fix:** Remove `hasLoadedOnce` from `fetchTransactions` dependencies. Use a ref to read `hasLoadedOnce` inside the callback instead.

**Issue #3 — `useEffect` dependency includes `fetchTransactions` which changes with `user`**
- **Severity:** LOW
- **File:** `src/contexts/TransactionsContext.tsx:284-289`
- When `user` changes (login/logout), `fetchTransactions` ref changes, effect re-runs. This is correct behavior. The `fetchingRef` guard prevents double-fetching. No action needed.

---

## PART 3 — Dashboard Consistency Check

| Check | Status |
|-------|--------|
| Metrics derived from transactions state | PASS — `useMemo` in context |
| No independent queries to Supabase | PASS |
| No duplicated calculations | PASS |
| Dashboard shows skeleton until ready | PASS — `loading={initialLoading \|\| !hasLoadedOnce}` |

**Issue #4 — Dashboard `loading` logic has a subtle gap**
- **Severity:** LOW
- **File:** `src/pages/Index.tsx:86`
- `loading={initialLoading || !hasLoadedOnce}` — If there's a load error on first attempt, `hasLoadedOnce` stays `false` and `initialLoading` becomes `false`, so `loading` is `true`. The Dashboard shows the error UI inside the `loading` branch, which works correctly. No issue.

**No dashboard issues found.**

---

## PART 4 — Chat System Audit

| Check | Status |
|-------|--------|
| Streaming completes before action parsing | PASS — `parseAIResponse` called after stream loop |
| No duplicate transaction creation | PASS — single `parseAIResponse` call per response |
| Action extraction uses Zod validation | PASS |
| Prototype pollution protection | PASS |

**Issue #5 — `delete_all_transactions` via chat has confirmation dialog but action is extracted from full content**
- **Severity:** LOW
- **File:** `src/components/chat/ChatInterface.tsx:94-96`
- The `delete_all_transactions` action correctly shows a confirmation dialog (`setPendingDeleteAll`). User must confirm. This is safe.

**Issue #6 — Chat sends entire message history to edge function**
- **Severity:** MEDIUM
- **File:** `src/components/chat/ChatInterface.tsx:130`
- `[...messages, { role: 'user', content: userMessage }]` sends ALL stored messages. The edge function caps at 50 messages (`MAX_MESSAGES`), but long conversations could hit payload limits or slow responses.
- **Fix:** Trim to last N messages client-side before sending.

---

## PART 5 — Chat Message Storage

| Check | Status |
|-------|--------|
| Messages contain valid string content | PASS — Zod-validated on edge function |
| No null values inserted | PASS — content is required in schema |
| Ordering by `created_at` | PASS |
| History fetch doesn't overwrite pending | PASS — fetch only on mount |

**Issue #7 — `useChatMessages.addMessage` updates state optimistically but could fail silently**
- **Severity:** LOW
- **File:** `src/hooks/useChatMessages.tsx`
- If `insertChatMessage` fails, the message is not added to state (returns `null`), but no toast is shown to the user. The error is only logged.
- **Fix:** Show a toast on failure.

---

## PART 6 — Streaming Stability

| Check | Status |
|-------|--------|
| AbortController cleanup | PASS — cleared in `finally` block |
| Timeout handling | PASS — 60s timeout |
| Partial response safety | PASS — malformed JSON chunks are skipped |
| Buffer flushing | PASS — remaining buffer processed after stream ends |

**No streaming issues found.**

---

## PART 7 — State Management Safety

| Check | Status |
|-------|--------|
| No state mutation outside React | PASS |
| Stale closures | See Issue #2 |
| Unnecessary re-renders | See below |
| Infinite loops in useEffect | PASS — `fetchingRef` prevents loops |

**Issue #8 — `TransactionsContext` value object recreated every render**
- **Severity:** MEDIUM
- **File:** `src/contexts/TransactionsContext.tsx:291-308`
- The `value` object is created inline, causing all consumers to re-render on every provider render. Since `transactions` state changes trigger this anyway, the impact is limited, but wrapping in `useMemo` would be cleaner.
- **Fix:** Wrap `value` in `useMemo` with appropriate dependencies.

**Issue #9 — `TransactionList` re-sorts on every render**
- **Severity:** LOW
- **File:** `src/components/dashboard/TransactionList.tsx:42-45`
- `[...transactions].sort(...)` runs on every render. Should use `useMemo`.
- **Fix:** `const sortedTransactions = useMemo(() => [...transactions].sort(...), [transactions, sortOrder]);`

---

## PART 8 — Performance Risks

| Check | Status |
|-------|--------|
| Redundant Supabase queries | PASS — `fetchingRef` prevents duplicates |
| Excessive state updates | See Issue #8 |
| Unnecessary re-renders | See Issues #8, #9 |
| Large lists without memoization | See Issue #9 |

**Issue #10 — `TransactionList` grouping logic runs on every render**
- **Severity:** LOW
- **File:** `src/components/dashboard/TransactionList.tsx:51-64`
- Grouping and date key sorting should be memoized.

---

## PART 9 — Data Safety Check

| Check | Status |
|-------|--------|
| `deleteAllTransactions` requires confirmation | PASS — AlertDialog in ChatInterface |
| Bulk deletion via chat requires user approval | PASS |
| No accidental database resets possible | PASS |
| RLS protects cross-user data | PASS |

**All destructive operations require explicit user action.** No data safety issues found.

---

## PART 10 — Final Report Summary

### Critical Issues: **NONE**

### High Priority Issues: **NONE**

### Medium Priority Issues

| # | File | Problem | Fix |
|---|------|---------|-----|
| 2 | `TransactionsContext.tsx:157` | `hasLoadedOnce` in `fetchTransactions` deps causes unnecessary effect re-trigger | Use a ref to read `hasLoadedOnce` inside callback |
| 6 | `ChatInterface.tsx:130` | Full message history sent to AI on every message | Trim to last 20-30 messages client-side |
| 8 | `TransactionsContext.tsx:291` | Context value object recreated every render | Wrap in `useMemo` |

### Low Priority Issues

| # | File | Problem | Fix |
|---|------|---------|-----|
| 7 | `useChatMessages.tsx` | Silent failure on message insert | Add toast on error |
| 9 | `TransactionList.tsx:42` | Sorting not memoized | Use `useMemo` |
| 10 | `TransactionList.tsx:51` | Grouping not memoized | Use `useMemo` |

### Architecture Assessment

The codebase follows the correct layered architecture. All Supabase access is in the service layer. Auth gates data fetching properly. Optimistic updates work correctly with rollback on failure. Metrics are derived via `useMemo`. The `hasLoadedOnce` + `initialLoading` pattern prevents premature zero-value rendering.

**The system is production-stable.** The identified issues are optimizations, not bugs. No race conditions, data loss risks, or critical architecture violations were found.

### Recommended Refactors (in priority order)

1. Memoize context `value` object in `TransactionsProvider`
2. Use ref for `hasLoadedOnce` in `fetchTransactions` to avoid dependency churn
3. Trim chat message history before sending to edge function
4. Memoize sort/group in `TransactionList`
5. Add error toast in `useChatMessages.addMessage`

