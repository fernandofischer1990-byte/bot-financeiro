

## Fix: Income Column Not Detected Because First Row Has Empty Cell

### Root Cause

**Line 238** of `ImportWizard.tsx`:
```typescript
const columns = Object.keys(data[0]);
```

The xlsx library's `sheet_to_json` omits keys for empty cells. The first data row is "jantar" (an expense) — its "Receitas" cell is empty, so the key `"Receitas"` doesn't appear in `data[0]`. The auto-detector never sees the income column.

**Result**: `mapping.income = ""`, income rows have no value to read, and all 6 income transactions are silently dropped.

### Fix — One line change

**File**: `src/components/import/ImportWizard.tsx`, line 238

Replace:
```typescript
const columns = Object.keys(data[0]);
```

With:
```typescript
const columns = [...new Set(data.flatMap(row => Object.keys(row)))];
```

This collects column names from **all rows**, ensuring columns that only have values in some rows (like "Receitas") are always detected.

### Why this is sufficient

- Auto-detection logic is correct — it already maps "Receitas" → income
- Split-mode processing is correct — it already checks income before expense
- `normalizeAmount` is correct — it handles both number and string values
- `getRowValue` is correct — it does case-insensitive lookup

The only bug is that the income column name is never discovered.

### File Summary

| File | Change |
|------|--------|
| `src/components/import/ImportWizard.tsx` | Line 238: collect columns from all rows, not just first |

No database changes. No new files.

