

## Mapping Templates — Save & Reuse Column Mappings

### What it does
Users can save their current column mapping as a named template (e.g., "Banco do Brasil CSV") and load it on future imports, skipping manual mapping entirely.

### Changes

#### 1. New DB table: `mapping_templates`
Create via migration:
```sql
CREATE TABLE public.mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  mapping jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own templates" ON public.mapping_templates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

#### 2. New service: `src/services/mappingTemplateService.ts`
Three functions using Supabase client:
- `fetchMappingTemplates(userId)` → returns `{ id, name, mapping }[]`
- `saveMappingTemplate(userId, name, mapping)` → upsert by (user_id, name)
- `deleteMappingTemplate(id)` → delete by id

#### 3. Update `src/components/import/ColumnMapper.tsx`
Add a toolbar above the mapping fields with:
- **Load template**: a `<Select>` dropdown listing saved templates. On select, calls `onMappingChange()` with the stored mapping.
- **Save template**: a button that opens a small inline input for the template name + save button. Calls `saveMappingTemplate`.
- **Delete**: a trash icon next to each template option in the dropdown.

New props added: `templates`, `onSaveTemplate`, `onDeleteTemplate`, `onLoadTemplate`.

#### 4. Update `src/components/import/ImportWizard.tsx`
- Fetch templates on mount (alongside `userMappings`).
- Pass templates + handlers to `ColumnMapper`.
- When a template is loaded and it satisfies validation (date + amount/income/expense), auto-skip to processing like auto-detect does.

### File Summary

| File | Change |
|------|--------|
| Migration SQL | New `mapping_templates` table with RLS |
| `src/services/mappingTemplateService.ts` | **NEW** — CRUD for templates |
| `src/components/import/ColumnMapper.tsx` | Template load/save/delete UI toolbar |
| `src/components/import/ImportWizard.tsx` | Fetch templates, pass handlers, auto-skip on template load |

