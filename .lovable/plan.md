

## Invisible Import — Zero Manual Mapping

### What changes

The current flow already auto-skips the mapping step when columns are detected. The upgrade makes this the **only** path, with manual mapping as a hidden fallback.

### Changes

#### 1. `src/components/import/ImportWizard.tsx`

**Add confidence scoring to `autoDetectMapping`:**
- Return a `confidence` object alongside the mapping: `{ mapping, confidence, detectedStructure, warnings }`
- Exact alias match = 100%, partial/fuzzy match = 70%, no match = 0%
- `detectedStructure`: `'split'` (Receita+Despesa), `'single'` (Valor), or `'unknown'`
- `warnings[]`: e.g. "Coluna 'Total' detectada e ignorada", "3 linhas ignoradas por valores inválidos"

**Update flow logic:**
- If overall confidence >= 70% (date + amount source detected): skip mapping entirely → go straight to preview
- If confidence < 70%: show fallback mapping UI with a message "Não foi possível detectar a estrutura do arquivo automaticamente"

**Update step bar:**
- Remove 'mapping' from the visible steps in the default flow. Steps become: Upload → Duplicatas → Revisão → Confirmar
- Only show 'Colunas' step if fallback mode is active

**Add detection info banner** above the preview (DuplicateReview step):
- Show detected structure: "Colunas de Receita e Despesa detectadas" or "Coluna de valor único detectada"
- Show warnings if any (ignored columns, skipped rows)

#### 2. `src/components/import/ImportWizard.tsx` — New types

```typescript
interface DetectionResult {
  mapping: ColumnMapping;
  confidence: number; // 0-100
  detectedStructure: 'split' | 'single' | 'unknown';
  warnings: string[];
}
```

#### 3. No changes to `ColumnMapper.tsx`

It remains as-is — it's the fallback UI. No deletion needed.

### File Summary

| File | Change |
|------|--------|
| `src/components/import/ImportWizard.tsx` | Add confidence engine to `autoDetectMapping`, skip mapping by default, show detection info, fallback mode |

No database changes. No new files. No new dependencies.

