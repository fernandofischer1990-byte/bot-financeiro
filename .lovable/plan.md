

# Fix: Structural Hardening of Transaction Fetching

## Problem

Two issues causing dashboard to show zeroed values:

1. **`fetchUserTransactions`** returns `data: []` on errors, masking failures as empty state
2. **`fetchTransactions`** uses `else if (data)` which treats `[]` as falsy, skipping valid empty results

## Changes

### 1. `src/services/transactionService.ts` — Rewrite `fetchUserTransactions`

- Change return type to `Promise<{ data: Transaction[] | null; error: string | null }>`
- Validate `userId` upfront — return `{ data: null, error }` if empty/invalid
- Remove `Promise.race` and `FETCH_TIMEOUT_MS` constant
- On Supabase error: return `{ data: null, error }` (not `data: []`)
- On catch: return `{ data: null, error }` (not `data: []`)
- If `data` is unexpectedly null from Supabase (no error but null): return `{ data: null, error }` 
- Only return `data: []` when Supabase genuinely returns empty array

### 2. `src/contexts/TransactionsContext.tsx` — Fix `fetchTransactions` consumer

- Change condition from `else if (data)` to `else if (data !== null)`
  - This ensures `[]` (valid empty) updates state, while `null` (error) does not overwrite
- Apply `sortByDateDesc` when setting: `setTransactions(sortByDateDesc(data))`
- On error branch: do NOT touch `setTransactions` — preserve existing state
- Keep all other logic (auth gating, optimistic updates, hasLoadedOnce) unchanged

## Files Changed

| File | Change |
|------|--------|
| `src/services/transactionService.ts` | Rewrite `fetchUserTransactions`: validate userId, remove timeout/race, return `null` on errors |
| `src/contexts/TransactionsContext.tsx` | Fix consumer: `data !== null` check, apply `sortByDateDesc`, don't clear state on error |

2 files edited. No database changes.

