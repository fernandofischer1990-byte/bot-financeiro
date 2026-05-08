# Jornada de Investimentos — Saldo Disponível, Investido e Patrimônio Total

## Objetivo

Separar investimentos do saldo disponível, criando 3 indicadores: **Saldo Disponível**, **Investimentos** e **Patrimônio Total**. Investimentos deixam de ser tratados como despesa.

---

## 1. Banco de dados (migration)

Estender a tabela `transactions` para suportar o novo tipo `investment`:

- Adicionar valor `'investment'` ao enum `transaction_type`.
- Novas colunas (todas opcionais, usadas apenas quando `type = 'investment'`):
  - `investment_operation` — `deposit | withdraw | yield | loss`
  - `investment_type` — `cdb | tesouro_direto | acoes | fii | criptomoedas | previdencia | poupanca | etf | renda_fixa | outros`
  - `institution` — texto livre (ex.: "Nubank", "XP")
- Validation trigger garantindo que, quando `type = 'investment'`, `investment_operation` e `investment_type` são obrigatórios (e ausentes quando `type` é `income`/`expense`).
- RLS já existente cobre as novas colunas (mesma tabela).

---

## 2. Camada de dados / domínio

- `TransactionsContext`: estender `Transaction` com os novos campos opcionais e `TransactionType` para incluir `'investment'`.
- `metricsCalculator.ts`: passar a expor:
  ```ts
  {
    availableBalance, // income - expenses - deposits + withdraws
    investedBalance,  // deposits - withdraws + yields - losses
    netWorth,         // available + invested
    totalIncome, totalExpenses,
    investmentSummary: { deposits, withdraws, yields, losses, byType: Record<string, number> },
    byCategory, monthlyData, // inalterados (apenas income/expense)
    monthlyNetWorth: { month, available, invested, total }[]
  }
  ```
  - Investimentos NÃO entram em `byCategory` nem em `monthlyData` (receitas vs despesas).
  - Manter `totalBalance` como alias de `availableBalance` para compatibilidade.

---

## 3. UI — Dashboard

- Substituir os 3 MetricCards atuais por: **Saldo Disponível**, **Investimentos**, **Patrimônio Total** (com ícones e variantes próprias; investimento em tom accent).
- Novo gráfico **Distribuição Patrimonial** (Disponível vs Investido) — pie/donut.
- Novo gráfico **Evolução Patrimonial** (linha: patrimônio total ao longo do tempo) usando `monthlyNetWorth`.
- `MonthlyChart` (Receitas vs Despesas) permanece como está.
- `TransactionList` exibe ícone/badge distinto para investimentos (sem afetar totais de despesa).

---

## 4. Nova aba "Investimentos"

Nova seção navegável (tab no Dashboard ou rota), contendo:

- Botão **+ Novo Investimento** abrindo formulário (`InvestmentForm`) com campos: operação, tipo, instituição, valor, data, descrição.
- Resumo: saldo investido, distribuição por tipo, rentabilidade acumulada (yields − losses).
- Lista de movimentações de investimento (filtradas por `type='investment'`).
- Gráfico de distribuição por `investment_type`.

---

## 5. Chat / IA

- `actionParser.ts` (`AddTransactionSchema`): aceitar `type: 'investment'` com `investment_operation` e `investment_type` opcionais.
- `chatService.ts` (`ChatContext`): adicionar `available_balance`, `invested_balance`, `net_worth`, `investment_summary`.
- Edge function `supabase/functions/chat/index.ts`: atualizar system prompt para reconhecer "investi", "apliquei", "aporte", "resgatei", "rendimento", "prejuízo", "CDB", "tesouro", "ações", "ETF", "FII", "cripto", "previdência" e responder com payload de investimento. Incluir os novos indicadores no contexto enviado ao modelo.
- Confirmação manual continua obrigatória (regra existente).

---

## 6. Formulário manual

`TransactionForm` ganha um seletor de tipo com 3 opções (Receita / Despesa / Investimento). Quando "Investimento", o form troca os campos de categoria por: operação, tipo de investimento e instituição.

---

## Arquivos a criar

- `supabase/migrations/...` (via tool de migration)
- `src/lib/constants.ts` — adicionar `INVESTMENT_TYPES`, `INVESTMENT_OPERATIONS` com labels/ícones
- `src/components/investments/InvestmentForm.tsx`
- `src/components/investments/InvestmentsTab.tsx`
- `src/components/dashboard/NetWorthChart.tsx`
- `src/components/dashboard/PatrimonyDistributionChart.tsx`

## Arquivos a editar

- `src/contexts/TransactionsContext.tsx`
- `src/lib/metricsCalculator.ts`
- `src/services/transactionService.ts` (insert/update aceitando novos campos)
- `src/services/chatService.ts` (`ChatContext`)
- `src/components/dashboard/Dashboard.tsx` (cards + novos gráficos)
- `src/components/dashboard/TransactionList.tsx` (badge investimento)
- `src/components/transactions/TransactionForm.tsx`
- `src/lib/actionParser.ts`
- `supabase/functions/chat/index.ts` (system prompt + contexto)
- `src/pages/Index.tsx` (nova aba Investimentos)

## Não-objetivos (desta entrega)

- Integração com corretoras / cotações em tempo real
- Importação automática de extratos de investimento
- Projeções FIRE / metas patrimoniais
- Edição em massa de investimentos
