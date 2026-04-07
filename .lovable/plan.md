

## Fix: Ambiguous Currency Format Parsing

### Problem
`normalizeAmount` assumes **Brazilian format** whenever a comma is present: it strips dots (thousands) and converts comma to decimal point. But the test file `teste_2.xlsx` has US-style values like `R$ 4,649.00` where comma=thousands and dot=decimal.

Result: `R$ 4,649.00` → strips dot → `4,64900` → comma→dot → `4.64900` → **4.65** instead of **4649.00**.

Dates and income/expense classification are working correctly.

### Fix — `src/lib/transactionNormalization.ts`

Replace the naive "has comma = Brazilian" logic (lines 69-73) with format detection:

```typescript
// Detect format by analyzing separator positions
if (cleaned.includes(',') && cleaned.includes('.')) {
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastDot > lastComma) {
    // US format: 4,649.00 → comma is thousands, dot is decimal
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // BR format: 1.234,56 → dot is thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
} else if (cleaned.includes(',')) {
  // Only comma: assume decimal (e.g. "50,00")
  cleaned = cleaned.replace(',', '.');
}
// If only dot: already correct (e.g. "50.00")
```

Logic: When **both** separators exist, the **last one** is always the decimal separator. This handles both `1.234,56` (BR) and `4,649.00` (US) correctly.

Apply the same fix to the `originalAmount` parser in `ImportWizard.tsx` (lines 298-305) which has the same bug.

### Verification Summary
- ✅ Dates: All Portuguese long-form dates parsed correctly
- ✅ Income/Expense: Split columns detected and classified correctly  
- ❌ Amounts: `R$ 4,649.00` → 4.65 (should be 4649.00)
- ❌ Amounts: `R$ 1,483.88` → 1.48 (should be 1483.88)

### File Summary

| File | Change |
|------|--------|
| `src/lib/transactionNormalization.ts` | Fix `normalizeAmount` format detection (lines 69-73) |
| `src/components/import/ImportWizard.tsx` | Fix `originalAmount` parser with same logic |

No database changes.

