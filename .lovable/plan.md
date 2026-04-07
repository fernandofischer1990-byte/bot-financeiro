

## Fix: Portuguese Long-Form Date Parsing

### Problem
The uploaded XLSX has dates like `"terça-feira, fevereiro 17, 2026"`. The current `normalizeToLocalDate` in `dateUtils.ts` only handles:
- ISO format (`2025-01-11`)
- Brazilian numeric (`11/01/2025`)
- `new Date()` fallback (English only)

Portuguese month names cause `new Date()` to return `Invalid Date`, so all rows fall back to today's date.

### Fix — `src/lib/dateUtils.ts`

Add a Portuguese month name map and a parser that handles long-form dates before the `new Date()` fallback:

```typescript
const PT_MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};
```

In `normalizeToLocalDate`, before the `new Date()` fallback:
1. Normalize the string (remove accents, lowercase)
2. Strip weekday prefix (everything before the first comma+space)
3. Try to match pattern: `monthName day, year` → extract month from map, build `YYYY-MM-DD`

Example flow:
- Input: `"terça-feira, fevereiro 17, 2026"`
- Strip weekday: `"fevereiro 17, 2026"`
- Match: month=`fevereiro`→`02`, day=`17`, year=`2026`
- Output: `"2026-02-17"`

Also handle `"17 de fevereiro de 2026"` pattern for robustness.

### What stays the same
- Column auto-detection (already matches Receitas/Despesas/Descrição/Data)
- Split-mode processing logic
- No database changes

### File Summary

| File | Change |
|------|--------|
| `src/lib/dateUtils.ts` | Add Portuguese month name parsing to `normalizeToLocalDate` |

