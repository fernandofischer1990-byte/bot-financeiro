

# Fix: Auth Race Condition on Dashboard Load

## Root Cause

In `TransactionsContext.tsx` line 113-119, `fetchTransactions` clears state when `user` is null:

```typescript
if (!user) {
  setTransactions([]);  // <-- clears everything
  setInitialLoading(false);
  return;
}
```

During page refresh, `useAuth()` starts with `loading: true` and `user: null`. The `useEffect` on line 274 calls `fetchTransactions()` immediately (since `fetchTransactions` depends on `user` via `useCallback`). At this point `user` is still null (auth hydrating), so transactions get cleared to `[]` and `initialLoading` is set to `false`. The dashboard renders with zero values.

When auth finishes and `user` becomes available, `fetchTransactions` is recreated, the `useEffect` fires again, and transactions load — but there's a visible flash of empty state.

Note: `Index.tsx` gates `AuthenticatedApp` behind `authLoading`, but `TransactionsProvider` wraps the entire app (including the loading spinner), so its effects run during auth hydration.

## Fix (1 file)

### `src/contexts/TransactionsContext.tsx`

1. Import `loading` from `useAuth()` alongside `user`
2. In `fetchTransactions`: instead of clearing state when `user` is null, check if auth is still loading. If loading, do nothing (preserve existing state). Only clear when auth is resolved and user is definitively null (logged out).
3. Gate the initial fetch `useEffect` to only run when `!loading && user`:

```typescript
const { user, loading: authLoading } = useAuth();

const fetchTransactions = useCallback(async (silent = false) => {
    if (authLoading) return;          // auth not ready yet — do nothing
    if (!user) {
      setTransactions([]);            // user definitively logged out
      setInitialLoading(false);
      setLoadError(null);
      return;
    }
    // ... rest unchanged
}, [user, authLoading]);

useEffect(() => {
    if (!authLoading) {
      fetchTransactions();
    }
}, [authLoading, fetchTransactions]);
```

Also add a defensive check in `fetchTransactions` to not overwrite state with empty array on unexpected null data:

```typescript
if (data) {
  setTransactions(data);
} else {
  console.warn('[TransactionsContext] fetchTransactions returned empty data unexpectedly');
}
```

No changes needed to Dashboard, ChatInterface, or actionParser. The Dashboard already respects `initialLoading` and shows skeletons. The chat flow is already correct from prior fixes.

## Summary

1 file edited. No database changes. The fix ensures `fetchTransactions` never runs during auth hydration, preventing the flash of empty state on refresh.

