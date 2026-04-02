

## Fix: Column Mapping Split Mode Detection

### Problem
`hasSplitColumns` requires **both** `income` AND `expense` to be mapped. If a user maps only `Receita` or only `Despesa`, the `Valor` row remains visible and the info banner doesn't appear — confusing users into thinking `Valor` is still needed.

### Root Cause
Line 60 in `ColumnMapper.tsx`:
```ts
const hasSplitColumns = mapping.income !== '' && mapping.expense !== '';
//                                            ^^^ should be ||
```

### Fix — `src/components/import/ColumnMapper.tsx`

1. **Change `hasSplitColumns`** to trigger when **either** income or expense is mapped:
   ```ts
   const hasSplitColumns = mapping.income !== '' || mapping.expense !== '';
   ```

2. **Update info banner text** to handle single-column case:
   - Both mapped: "Colunas Receita e Despesa detectadas..."
   - Only one: "Coluna de [Receita/Despesa] detectada. Transações serão classificadas automaticamente."

That's it. The validation (`isValid`) and processing logic (`processSpreadsheetData` in ImportWizard) already handle single-column split mode correctly — only the UI gate is wrong.

| File | Change |
|------|--------|
| `src/components/import/ColumnMapper.tsx` | Fix `hasSplitColumns` from `&&` to `\|\|`, update banner text |

