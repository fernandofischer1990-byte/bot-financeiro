

# Fix: HMR-resilient TransactionsContext

## Problem

The `useTransactionsContext must be used within TransactionsProvider` error keeps recurring despite the component hierarchy being correct (`App.tsx` wraps everything in `TransactionsProvider`). This is caused by Vite HMR creating new module instances of `TransactionsContext.tsx` — the new `createContext()` call produces a different context object than what existing consumer components reference.

## Fix

Make the context object survive HMR by storing it on a module-level stable reference using `globalThis`:

```typescript
// At line 65, replace:
const TransactionsContext = createContext<TransactionsContextValue | null>(null);

// With:
const CONTEXT_KEY = '__TransactionsContext__';
const TransactionsContext: React.Context<TransactionsContextValue | null> =
  (globalThis as any)[CONTEXT_KEY] ??= createContext<TransactionsContextValue | null>(null);
```

This ensures that even when HMR reloads the module, the same React context object is reused, preventing the provider/consumer mismatch.

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/TransactionsContext.tsx` | Use `globalThis` to persist the context object across HMR reloads |

1 file, 1 line changed. No database changes. After this fix, we can proceed with the chat streaming test.

