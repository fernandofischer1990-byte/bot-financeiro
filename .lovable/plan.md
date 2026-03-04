

# Fix: Dashboard Rendering Premature Zero Values

## Problem

The Dashboard uses `initialLoading` as its sole gate. But `initialLoading` is set to `false` in `fetchTransactions` even when `hasLoadedOnce` is still `false` — for example, when `user` is null during auth hydration, or when data comes back as `null` unexpectedly. This means the Dashboard can render metrics from an empty `transactions` array before real data arrives.

The `hasLoadedOnce` ref already exists in `TransactionsContext` but is never exposed. The Dashboard has no way to distinguish "still loading first time" from "loaded but empty."

## Fix (2 files)

### 1. `src/contexts/TransactionsContext.tsx`

- Convert `hasLoadedOnce` from `useRef` to `useState` so it triggers re-renders
- Add it to the context interface and expose it in the provider value
- Ensure `initialLoading` stays `true` until `hasLoadedOnce` becomes `true` (i.e., don't set `initialLoading = false` in the `!user` early return if auth just resolved and there's no user — that's fine, but the key is the `hasLoadedOnce` flag)

### 2. `src/components/dashboard/Dashboard.tsx`

Replace the simple `if (loading)` check with a three-state rendering logic:

- `loading === true` (or `!isReady`) → show skeletons
- `loadError` present → show error UI with retry
- Data loaded, `transactions.length === 0` → show empty state message
- Otherwise → render metrics and charts

Add `isReady` prop (mapped from `hasLoadedOnce` in Index.tsx) and update `src/pages/Index.tsx` to pass it.

### 3. `src/pages/Index.tsx`

Pass `isReady={!initialLoading && hasLoadedOnce}` (or equivalent) to Dashboard. Since we'll expose `hasLoadedOnce` from context, the Dashboard `loading` prop becomes: `initialLoading || !hasLoadedOnce`.

## Summary

3 files changed. No database changes. The fix ensures the Dashboard never renders metrics until the first successful fetch completes.

