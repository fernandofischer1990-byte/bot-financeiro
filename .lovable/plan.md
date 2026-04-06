

## Fix: Income Detection in Importer

### Root Cause

The `processSpreadsheetData` function in `ImportWizard.tsx` already has correct split-mode logic (lines 274-297). The issue is in the **single-amount fallback path** (line 296): `inferTransactionType` in `transactionNormalization.ts` defaults to `'expense'` when there's no explicit type indicator and the amount is positive (line 173). This means files with a single "Valor" column where positive = income are misclassified.

Additionally, `normalizeAmount` always returns `Math.abs()`, stripping the sign. The `originalAmount` variable (line 295) does preserve the sign, but only for simple numeric strings — Brazilian formats like `"-50,00"` aren't handled by the simple `parseFloat(String(rawAmount).replace(',', '.'))`.

### Changes

#### 1. `src/lib/transactionNormalization.ts` — Fix `inferTransactionType`

Currently line 168-173:
```ts
if (typeof amount === 'number' && amount < 0) {
  return 'expense';
}
return 'expense'; // ← always expense
```

Change to properly infer from sign:
```ts
if (typeof amount === 'number' && amount < 0) return 'expense';
if (typeof amount === 'number' && amount > 0) return 'income';
return 'expense'; // zero or NaN fallback
```

#### 2. `src/components/import/ImportWizard.tsx` — Fix `originalAmount` parsing

Line 295 uses a naive parse that doesn't handle Brazilian currency. Replace with a proper parser that handles `"-1.234,56"` format:

```ts
const originalAmount = typeof rawAmount === 'number' 
  ? rawAmount 
  : (() => {
      let s = String(rawAmount).replace(/R\$\s*/gi, '').trim();
      const neg = s.startsWith('-');
      if (neg) s = s.substring(1);
      s = s.replace(/\s/g, '');
      if (s.includes(',')) { s = s.replace(/\./g, '').replace(',', '.'); }
      const v = parseFloat(s);
      return isNaN(v) ? 0 : (neg ? -v : v);
    })();
```

#### 3. `src/components/import/ImportReviewTable.tsx` — Color-code income vs expense

Add color styling to the amount display:
- Income → `text-green-600`
- Expense → `text-red-600`

### What stays the same

- Split-mode logic (income/expense columns) — already works correctly
- `normalizeAmount` — keeps `Math.abs()` behavior (amount storage is always positive)
- No database changes, no new files

### File Summary

| File | Change |
|------|--------|
| `src/lib/transactionNormalization.ts` | Fix `inferTransactionType` to return `'income'` for positive amounts |
| `src/components/import/ImportWizard.tsx` | Fix `originalAmount` parsing for Brazilian currency formats |
| `src/components/import/ImportReviewTable.tsx` | Color-code income (green) vs expense (red) amounts |

