

# Refactor: Remove Realtime, Pure Optimistic Updates

## Root Cause of Inconsistency

The realtime subscription (lines 261-284) fires a full `fetchTransactions(true)` 500ms after every database change. This overwrites the optimistic state that was already applied by `handleAddTransaction`, `handleDelete`, etc. The sequence is:

1. User adds transaction via chat → `setTransactions(prev => [newTx, ...prev])` → dashboard updates instantly
2. 500ms later, realtime event fires → `fetchTransactions(true)` → full refetch replaces state
3. If the refetch is slow, the UI flickers. If it fails, the optimistic state is lost.

Removing realtime eliminates this race condition entirely. The state becomes the single source of truth, updated only by explicit user actions or manual refetch.

## Changes

### `src/contexts/TransactionsContext.tsx`

**Remove:**
- The `import { supabase }` (line 2) — no longer needed
- The entire realtime subscription `useEffect` (lines 261-284)

**Refactor `handleUpdate` to optimistic pattern:**
Currently it calls the backend first, then updates state on success. Change to: update state immediately, call backend, rollback on error.

```
// Before (non-optimistic):
const { error } = await updateTransactionById(...)
if (error) { toast error; return false }
setTransactions(prev => prev.map(...))

// After (optimistic):
let rollback: Transaction[] | null = null;
setTransactions(prev => {
  rollback = prev;
  return prev.map(tx => tx.id === id ? { ...tx, ...updates, updated_at: now } : tx);
});
const { error } = await updateTransactionById(...)
if (error) { if (rollback) setTransactions(rollback); toast error; return false }
```

**Refactor `handleAddMultiple` to add try/catch:**
Currently missing error handling for network failures — wrap in try/catch like `handleAddTransaction`.

**No other changes needed.** The `handleDelete` and `handleDeleteAll` already follow the optimistic pattern correctly. The `fetchTransactions` function remains for initial load and manual `refetch()`.

### Verification Checklist (no changes needed)
- ChatInterface uses `addTransaction` from context — confirmed
- TransactionForm uses `addTransaction` from context — confirmed
- No component calls `insertTransaction` directly — confirmed
- `metrics` and `overallMetrics` derive from `transactions` state via `useMemo` — confirmed
- `filteredTransactions` derives from `transactions` via `useMemo` — confirmed
- `initialLoading` is always finalized in `fetchTransactions` — confirmed

## How This Fixes the Flow

```text
insert → backend confirms → state updated → useMemo recalculates metrics → dashboard re-renders
         (no realtime)       (immediate)     (synchronous)                   (synchronous)
```

Single source of truth: `transactions` state. No external events can overwrite it. Manual `refetch()` remains available for explicit sync if needed.

## Files Changed
| File | Change |
|------|--------|
| `src/contexts/TransactionsContext.tsx` | Remove realtime subscription, remove supabase import, make handleUpdate optimistic, add try/catch to handleAddMultiple |

1 file edited. No database changes.

