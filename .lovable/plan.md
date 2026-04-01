

## Smart Auto-Import for Split Income/Expense Columns

### Problem
The importer only supports a single "amount" column. Bank spreadsheets often have separate Receita/Despesa columns and a Total/Saldo column that must be ignored.

### Changes

#### 1. `src/components/import/ColumnMapper.tsx` — Add `income` and `expense` fields to `ColumnMapping`

- Extend `ColumnMapping` interface: add `income: string` and `expense: string` fields
- Update `TARGET_FIELDS` to include Receita and Despesa rows
- When both `income` and `expense` are mapped, hide the `amount` row and show info badge: "Colunas Receita e Despesa detectadas. Transações serão classificadas automaticamente."
- Validation: require `date` + at least one of (`amount`, `income`, `expense`)

#### 2. `src/components/import/ImportWizard.tsx` — Smart auto-detection + split-column processing

**`autoDetectMapping()`** — expand alias lists:
- Date: `data, date, dt, transaction date`
- Description: `descricao, descrição, description, historico, histórico, detalhes, memo`
- Income: `receita, credit, income, entrada`
- Expense: `despesa, debit, expense, saída, saida`
- Amount: `valor, amount, value`
- Balance (to ignore): `total, saldo, balance, running balance`

If both income and expense columns are detected → set `mapping.income` and `mapping.expense`, leave `mapping.amount` empty.

**`processSpreadsheetData()`** — handle split columns:
- If `map.income` or `map.expense` are set, use split-column logic:
  - Row has income value > 0 → `type=income, amount=value`
  - Row has expense value > 0 → `type=expense, amount=value`
  - Both empty → skip row
- Otherwise fall through to existing single-amount logic

**Auto-skip mapping step**: if `date` + (`amount` OR (`income` AND `expense`)) are detected, skip directly to duplicates step.

#### 3. `src/components/import/ColumnMapper.tsx` — Update `ColumnMapping` default + reset

Update the initial mapping state in ImportWizard to include `income: ''` and `expense: ''`.

### File Summary

| File | Change |
|------|--------|
| `src/components/import/ColumnMapper.tsx` | Add `income`/`expense` to interface, conditional UI hiding amount when split detected, updated validation |
| `src/components/import/ImportWizard.tsx` | Expanded auto-detection aliases, split-column processing logic, updated initial mapping state |

No database changes. No new dependencies.

