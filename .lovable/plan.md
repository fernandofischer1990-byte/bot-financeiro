

# Enhanced Import Module - Mobills/YNAB/Mint Style

## Current State
The project already has a working import system with CSV/XLSX/PDF support, category suggestion, and a preview screen. This plan extends it with the requested features.

## What Will Be Built

### 1. Database: Import History Table
New `import_history` table to track all imports with file name, record counts, and duplicate counts. RLS policies scoped to user.

### 2. New Parsers: OFX & QIF
- `src/lib/ofxParser.ts` — Parse OFX (Open Financial Exchange) files used by most banks. Extract transactions from `<STMTTRN>` tags using regex (no external dependency needed).
- `src/lib/qifParser.ts` — Parse QIF (Quicken Interchange Format) files. Line-based format with `D` (date), `T` (amount), `P` (payee), `L` (category) fields.
- Both return the same `NormalizedTransactionRow[]` interface already used by spreadsheets.

### 3. Smart Column Mapper
- `src/components/import/ColumnMapper.tsx` — When auto-detection fails or user wants to override, show a UI with dropdowns mapping source columns to target fields (date, amount, description, type, category).
- Only shown for spreadsheet imports; OFX/QIF/PDF have fixed structures.

### 4. Duplicate Detection
- `src/lib/duplicateDetector.ts` — Compare incoming transactions against existing ones using a composite key: `date + amount + normalizedDescription`. Mark matches with a `duplicateStatus: 'duplicate' | 'possible' | 'unique'` flag.
- Exact match on date+amount+first 20 chars of normalized description = "duplicate"
- Same date+amount but different description = "possible"
- UI shows badges and lets user toggle inclusion.

### 5. Description Cleaner
- `src/lib/descriptionCleaner.ts` — Clean bank descriptions:
  - Remove trailing numbers/codes: `"AMAZON.COM*AB123"` → `"Amazon"`
  - Remove common prefixes: `"COMPRA CARTAO"`, `"PAG*"`, `"PGTO"`
  - Capitalize properly

### 6. Redesigned Import Flow (7-step wizard)
Replace the current `FileUpload` component with a multi-step wizard:

```text
Step 1: Upload        → drag & drop, format selection
Step 2: Column Map    → auto-detected, manual override (spreadsheets only)  
Step 3: Preview       → parsed data table
Step 4: Duplicates    → highlight & filter duplicates
Step 5: Categories    → AI suggestions with confidence badges
Step 6: Review        → final summary with totals
Step 7: Confirm       → import + save history
```

Component structure:
```text
src/components/import/
  ImportWizard.tsx        — Main wizard with step state
  FileDropZone.tsx        — Drag & drop upload area
  ColumnMapper.tsx        — Column mapping step
  DuplicateReview.tsx     — Duplicate detection results
  ImportReviewTable.tsx   — Final review table with edit/remove
  ImportSummary.tsx       — Summary card before confirmation
```

### 7. Import History Tab
- `src/components/import/ImportHistory.tsx` — Table showing past imports with date, filename, records imported, duplicates skipped. Fetched from `import_history` table.

### 8. Service Layer
- `src/services/importService.ts` — Handles saving import history records to the database. All Supabase calls stay in services.

## Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/ofxParser.ts` | OFX file parser |
| Create | `src/lib/qifParser.ts` | QIF file parser |
| Create | `src/lib/duplicateDetector.ts` | Duplicate detection logic |
| Create | `src/lib/descriptionCleaner.ts` | Bank description cleaner |
| Create | `src/components/import/ImportWizard.tsx` | Multi-step import wizard |
| Create | `src/components/import/FileDropZone.tsx` | Drag & drop upload zone |
| Create | `src/components/import/ColumnMapper.tsx` | Column mapping UI |
| Create | `src/components/import/DuplicateReview.tsx` | Duplicate review step |
| Create | `src/components/import/ImportReviewTable.tsx` | Final editable review table |
| Create | `src/components/import/ImportSummary.tsx` | Pre-confirmation summary |
| Create | `src/components/import/ImportHistory.tsx` | Past imports list |
| Create | `src/services/importService.ts` | Import history DB service |
| Modify | `src/services/fileParsingService.ts` | Add OFX/QIF routing |
| Modify | `src/pages/Index.tsx` | Replace FileUpload with ImportWizard |

## Database Migration

```sql
CREATE TABLE public.import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_format text NOT NULL,
  total_records int NOT NULL DEFAULT 0,
  imported_records int NOT NULL DEFAULT 0,
  duplicate_records int NOT NULL DEFAULT 0,
  skipped_records int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own import history"
  ON public.import_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own import history"
  ON public.import_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

## Architecture Compliance
- All Supabase calls in `/services`
- Parsers are pure functions in `/lib`
- Components consume context only
- No new direct DB queries in components
- Existing `TransactionsContext.addMultipleTransactions` used for the actual insert

