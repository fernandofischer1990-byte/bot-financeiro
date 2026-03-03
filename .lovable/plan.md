

# Audit Report & Fix Plan: Data Flow Consistency

## Findings

### A) Chat → Transaction → Dashboard Flow

**ISSUE 1 (CRITICAL): `sortByDateDesc` mutates array in place**
`TransactionsContext.tsx` line 67-72: `sortByDateDesc` uses `.sort()` which mutates the array. When called as `sortByDateDesc([data, ...prev])`, a new array is created so this is technically safe for the spread cases. However, `sortByDateDesc` is a function that mutates its input — this is a ticking bomb if ever called with a reference that shouldn't be mutated.

**ISSUE 2 (CRITICAL): `handleDelete` captures stale `transactions` closure**
`TransactionsContext.tsx` line 198-214: `handleDelete` has `transactions` in its dependency array and uses it for rollback (`const previousTransactions = transactions`). But `transactions` is a state value captured at callback creation time. If multiple deletes happen in sequence, the rollback array is stale. Same issue with `handleDeleteAll` (line 216-240).

**ISSUE 3 (MODERATE): `addMessage` returns `null` silently on error**
`useChatMessages.tsx` line 48-75: If the DB insert for the chat message fails, `addMessage` returns `null` but `ChatInterface.tsx` line 116 does `await addMessage('user', userMessage)` without checking the result. The user message may not persist, but the flow continues.

**ISSUE 4 (MODERATE): Realtime refetch can overwrite optimistic state**
`TransactionsContext.tsx` line 248-270: The realtime subscription calls `fetchTransactions(true)` with a 500ms debounce. After `addTransaction` optimistically updates state (line 160), the realtime event triggers a full refetch 500ms later, which replaces the state. This is normally fine, but if the refetch is slow or fails, it can cause flicker or data loss.

**ISSUE 5 (LOW): No try/catch in `handleAddTransaction`**
`TransactionsContext.tsx` line 150-162: `insertTransaction` could throw (network error), and there's no try/catch. The error would propagate to `ChatInterface.parseAIResponse` which also has no try/catch around `addTransaction` (line 75).

**ISSUE 6 (LOW): `extractAction` fallback regex is greedy**
`actionParser.ts` line 132: The fallback regex `\{[\s\S]*?"action"[\s\S]*?\}` can match unintended content. This was noted before but the fix only removed it from `cleanContentForDisplay`, not from `extractAction` itself.

### B) Confirmation Checklist

| Check | Status | Notes |
|-------|--------|-------|
| `insertTransaction` returns created tx | ✅ OK | Uses `.select().single()` |
| Context uses immutable state | ⚠️ PARTIAL | `sortByDateDesc` mutates input array |
| Refetch after create/update/delete | ✅ OK | Realtime subscription triggers refetch |
| Metrics recalculated from state | ✅ OK | `useMemo` on `filteredTransactions` and `transactions` |
| Race condition on initial load | ⚠️ MINOR | `fetchingRef` prevents concurrent fetches, but `initialLoading` starts as `true` and is set to `false` even on error — dashboard shows empty state, not loading |
| `initialLoading` finalized correctly | ✅ OK | Always set to `false` in `fetchTransactions` |
| State overwritten after fetch | ⚠️ YES | Realtime refetch replaces optimistic state (by design, but if it fails, stale data stays) |

### C) Async/Error Issues

| Check | Status | Location |
|-------|--------|----------|
| async without await | ✅ OK | All awaited |
| try/catch suppressing errors | ⚠️ YES | `useChatMessages.addMessage` logs error but returns null silently |
| Silent backend errors | ⚠️ YES | `handleAddTransaction` has no try/catch for network failures |
| Chat not calling persistence | ✅ OK | `parseAIResponse` calls `addTransaction` correctly |
| Creation function isolated | ✅ OK | Single `insertTransaction` in service layer |

### D) Consistency Guarantees

| Guarantee | Status |
|-----------|--------|
| Same function for chat + form | ✅ OK | Both use `addTransaction` from context |
| State updated after success | ✅ OK | Optimistic update via `setTransactions` |
| Dashboard depends on context only | ✅ OK | `Index.tsx` passes `filteredTransactions` and `metrics` from context |
| Initial load waits for fetch | ✅ OK | `initialLoading` flag controls skeleton rendering |

### E) Potential Race Conditions

| Issue | Severity | Details |
|-------|----------|---------|
| Stale closure in `handleDelete` | MEDIUM | `transactions` captured at creation time |
| Multiple rapid adds from chat | LOW | Each adds to `prev` via callback, so order is preserved |
| `fetchTransactions` guard | OK | `fetchingRef` prevents concurrent fetches |

---

## Fix Plan

### Fix 1: Wrap `handleAddTransaction` in try/catch (TransactionsContext.tsx)
Prevent unhandled rejections from network errors propagating to chat.

### Fix 2: Fix stale closure in `handleDelete` and `handleDeleteAll` (TransactionsContext.tsx)
Use functional state update pattern (`prev => ...`) for capturing previous state instead of closing over `transactions`. Remove `transactions` from dependency arrays.

### Fix 3: Make `sortByDateDesc` non-mutating (TransactionsContext.tsx)
Use `[...txs].sort(...)` instead of `txs.sort(...)`.

### Fix 4: Add try/catch in `parseAIResponse` (ChatInterface.tsx)
Wrap the `addTransaction` call in try/catch so that backend failures show a clear error toast instead of crashing.

### Fix 5: Remove dangerous fallback regex in `extractAction` (actionParser.ts)
The fallback `\{[\s\S]*?"action"[\s\S]*?\}` regex can match unintended JSON. Remove it — if `<!--ACTION:...-->` isn't found, return no action. The AI prompt already specifies the ACTION format.

---

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/TransactionsContext.tsx` | Fix 1, 2, 3 |
| `src/components/chat/ChatInterface.tsx` | Fix 4 |
| `src/lib/actionParser.ts` | Fix 5 |

3 files edited. No database changes.

