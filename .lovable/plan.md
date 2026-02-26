

# Fix: Move TransactionsProvider to App.tsx

## Root Cause
The `TransactionsProvider` is conditionally rendered inside `Index.tsx` only when the user is authenticated. During React's reconciliation (especially with HMR or rapid auth state changes), there's a race condition where `AuthenticatedApp` renders before the provider is fully mounted, causing the "must be used within TransactionsProvider" error.

## Solution
Move `TransactionsProvider` to `App.tsx` so it wraps the entire app unconditionally. The provider already handles `!user` gracefully (returns empty state), so this is safe.

### Changes

**`src/App.tsx`** — Wrap router with `TransactionsProvider`
- Import `TransactionsProvider` from contexts
- Place it inside `AuthProvider`, wrapping `BrowserRouter`

**`src/pages/Index.tsx`** — Remove conditional provider wrapping
- Remove `TransactionsProvider` import and wrapper from `Index`
- Have `Index` render `AuthenticatedApp` directly when user exists (no wrapper needed)
- Move `useTransactionsContext` call to stay in `AuthenticatedApp` (already there)

This eliminates the race condition entirely since the provider is always in the tree.

