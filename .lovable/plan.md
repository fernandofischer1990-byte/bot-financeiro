

## Fix: Header Detection Not Matching Accented Aliases

### Root Cause

The `autoDetectWithConfidence` function normalizes the input header (removes accents via NFD decomposition) but then compares against alias arrays that still contain accented characters. For example:

- Input column `"Saída"` → normalized to `"saida"` → compared against `EXPENSE_ALIASES` which contains `'saída'` (with accent) → **no match**
- Same issue with `'histórico'` in `DESC_ALIASES`

Additionally, the alias lists are missing several common bank header variants for income (e.g., `'receitas'`, `'valor recebido'`).

### Fix — `src/components/import/ImportWizard.tsx`

1. **Normalize all alias arrays** so they contain only accent-free lowercase strings (matching what `norm()` produces). This ensures the `includes(n)` comparison always works.

2. **Expand alias lists** with missing variants:
   - `INCOME_ALIASES`: add `'receitas'`, `'valor recebido'`
   - `EXPENSE_ALIASES`: add `'despesas'`, `'valor pago'`
   - `DESC_ALIASES`: add `'lancamentos'`
   - `DATE_ALIASES`: add `'posted date'`

3. **Also normalize BALANCE_ALIASES comparison** (already all-lowercase and unaccented, but apply `norm()` for safety).

4. **Use `.some()` with `norm()` instead of `.includes()`** in the matching loop, so all comparisons are accent-safe:
   ```ts
   const match = (aliases: string[], value: string) => 
     aliases.some(a => norm(a) === value);
   ```

### What stays the same

- `ColumnMapper.tsx` — already has `income`/`expense` fields, correct `hasSplitColumns` logic, and proper validation. No changes needed.
- `processSpreadsheetData` — already handles split mode correctly.
- No database changes. No new files.

### File Summary

| File | Change |
|------|--------|
| `src/components/import/ImportWizard.tsx` | Fix alias matching to normalize both sides, expand alias lists |

