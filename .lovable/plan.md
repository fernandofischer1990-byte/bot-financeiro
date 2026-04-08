

## Fix: Income Rows Being Silently Filtered Out

### Problem

The uploaded file has 26 rows (20 expenses + 6 incomes). The importer shows only 20 rows — all expenses. The 6 income rows are silently removed by the `.filter(r => !r.error && r.amount > 0)` at the end of `processSpreadsheetData`. This means income values from the "Receitas" column are returning `null` from `normalizeAmount`.

### Root Cause

Two issues work together:

1. **`normalizeAmount` silently discards non-number, non-string values** (line 51-53). The xlsx library can return cell values as unexpected types (e.g., `Object`, formatted cell references) depending on how the spreadsheet was authored. Any value that isn't exactly `typeof 'number'` or `typeof 'string'` returns `null` — no fallback.

2. **Split-mode uses truthy checks instead of explicit null checks.** `if (rawIncome && rawIncome > 0)` fails for `null` silently — there's no way to know if the value was genuinely empty or if parsing failed.

### Fix

#### `src/lib/transactionNormalization.ts`

In `normalizeAmount`, instead of returning `null` for non-number/non-string types, coerce to string and continue parsing:

```typescript
// Before (line 51-53):
if (typeof value !== 'string') {
  return null;
}

// After:
if (value === null || value === undefined) {
  return null;
}
if (typeof value !== 'string') {
  // Coerce booleans, objects, etc. to string for parsing
  value = String(value);
  if (value === 'undefined' || value === 'null' || value === 'false' || value === 'true') {
    return null;
  }
}
```

#### `src/components/import/ImportWizard.tsx`

In `processSpreadsheetData`, add defensive row-key lookup and console warnings:

1. Add a helper that does case-insensitive key lookup on the row object (in case xlsx normalizes keys differently than the detected column names):

```typescript
const getRowValue = (row: Record<string, unknown>, key: string): unknown => {
  if (key in row) return row[key];
  // Fallback: case-insensitive match
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lowerKey) return row[k];
  }
  return undefined;
};
```

2. Use `getRowValue` instead of direct `row[map.income]` / `row[map.expense]` / `row[map.amount]` access in the processing loop.

3. Add `console.warn` when a row in split mode has both income and expense as null/0, to surface parsing issues during development.

### What stays the same

- Auto-detection logic (aliases, confidence scoring) — already correct
- ImportReviewTable display — already shows green/red based on type
- No database changes, no new files

### File Summary

| File | Change |
|------|--------|
| `src/lib/transactionNormalization.ts` | Coerce unknown types to string instead of returning null |
| `src/components/import/ImportWizard.tsx` | Add case-insensitive row key lookup, debug warnings |

