# Módulo de Investimentos — Segregação Financeira + Upload Inteligente

Implementação completa da camada patrimonial separada da operação diária, com persistência integral de dados importados e segregação correta em todos os pontos do sistema.

---

## 1. Banco de dados (migration)

**Tabela nova `investments`** (entidade saldo/posição, distinta de `transactions`):

- `id`, `user_id`, `created_at`, `updated_at`
- `investment_name` (text, obrigatório)
- `investment_type` (text — `renda_fixa`, `acao`, `etf`, `fii`, `tesouro_direto`, `cripto`, `previdencia`, `fundo`, `coe`, `outros`)
- `institution` (text)
- `initial_amount` (numeric)
- `current_balance` (numeric)
- `start_date`, `end_date` (date, nullable)
- `term_days`, `term_months`, `term_years` (int, nullable)
- `metadata` (jsonb — preserva TODA coluna desconhecida da planilha)
- `imported_from` (text — `xlsx`, `csv`, `manual`, `chat`)
- `source_file_name` (text, nullable)
- `imported_at` (timestamptz, nullable)
- RLS por `auth.uid() = user_id` + GRANTs

**Tabela `transactions`** — adicionar coluna:
- `financial_scope` text NOT NULL DEFAULT `'operational'` com CHECK em (`operational`,`investment`)
- Backfill: registros com `type='investment'` → `financial_scope='investment'`; demais → `operational`
- Atualizar trigger `validate_investment_fields` para usar `financial_scope`

---

## 2. Camada de dados

- `Transaction` ganha `financial_scope: 'operational' | 'investment'`
- Novo tipo `Investment` + contexto/serviço (`investmentService.ts`, `InvestmentsContext.tsx`)
- `metricsCalculator.ts` reescrita das fórmulas:
  - `availableBalance = Σ(income op) − Σ(expense op)` — **somente** `financial_scope='operational'`
  - `investedBalance = Σ(current_balance dos investments) + Σ(deltas das transactions investment)`
  - `netWorth = availableBalance + investedBalance`
  - `byCategory`/`monthlyData` filtram **apenas** `financial_scope='operational'`
- Aportes/resgates registrados como transação investment **NÃO** alteram `availableBalance`

---

## 3. Upload Inteligente XLSX/CSV/XLS/OFX

Novo fluxo `InvestmentImportWizard` (4 etapas: Upload → Parsing → Revisão → Confirmação):

- `src/lib/investmentSpreadsheetParser.ts`:
  - `normalizeColumnName()` com NFD strip + lowercase + underscore
  - Mapeamento conhecido (Investimento→investment_name, Valor→initial_amount, Saldo→current_balance, Início→start_date, Fim→end_date, Prazo-dias/meses/anos, Investidora→institution)
  - Colunas desconhecidas → `metadata`
  - Parse de strings tipo `"2176dias"` → número
  - Inferência de `investment_type` por regex no nome (CDB→renda_fixa, Tesouro→tesouro_direto, FII→fundo_imobiliario, ETF→etf, PETR4/4 dígitos→acao, BTC/Bitcoin→cripto, COE→coe)
- Suporte XLSX/XLS/CSV via `xlsx` (já instalado); OFX via parser existente
- Persistência via `investmentService.bulkInsert()` com `source_file_name`, `imported_at`, `imported_from='xlsx'`

---

## 4. UI — Investimentos Tab

Reescrever `InvestmentsTab.tsx`:
- Botão **Importar Planilha** abrindo o wizard
- Botão **+ Novo Investimento** (form manual)
- Cards: Saldo Investido, Total Aportado, Rentabilidade, Nº Posições
- Tabela de posições (editar/excluir/filtrar por instituição/tipo)
- Gráficos:
  - Distribuição por instituição (pie)
  - Distribuição por tipo (pie)
  - Evolução patrimonial mensal (line)
  - Timeline de aportes (bar)

---

## 5. Dashboard

`Dashboard.tsx`:
- Cards Saldo Disponível / Investimentos / Patrimônio Total usando novas fórmulas
- `MonthlyChart` (Receitas vs Despesas) e `CategoryChart` filtram `financial_scope='operational'`
- `PatrimonyDistributionChart` e `NetWorthChart` consomem dados dos `investments` + transações investment

---

## 6. Chatbot

- `actionParser.ts`: aceita `financial_scope` no payload de transações
- `chat/index.ts`: system prompt reforça regra "aportes/resgates **não** alteram saldo disponível"; mapeia "apliquei/comprei/aportei/resgatei/rendimento" → `type='investment'` + `financial_scope='investment'`
- Confirmação manual continua obrigatória

---

## 7. Arquivos

**Criar:**
- `supabase/migrations/...` (tabela investments + financial_scope + backfill + trigger)
- `src/services/investmentService.ts`
- `src/contexts/InvestmentsContext.tsx`
- `src/lib/investmentSpreadsheetParser.ts`
- `src/components/investments/InvestmentImportWizard.tsx`
- `src/components/investments/InvestmentForm.tsx`
- `src/components/investments/InvestmentsTable.tsx`
- `src/components/investments/charts/InstitutionDistributionChart.tsx`
- `src/components/investments/charts/InvestmentTypeChart.tsx`

**Editar:**
- `src/contexts/TransactionsContext.tsx`, `src/lib/metricsCalculator.ts`, `src/services/transactionService.ts`
- `src/components/investments/InvestmentsTab.tsx`, `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/NetWorthChart.tsx`, `src/components/dashboard/PatrimonyDistributionChart.tsx`
- `src/lib/actionParser.ts`, `src/services/chatService.ts`, `supabase/functions/chat/index.ts`
- `src/App.tsx` (provider) e `src/pages/Index.tsx`

## Não-objetivos

- Cotações em tempo real / integração com corretora
- Cálculo de IR / come-cotas
- Rebalanceamento automático
