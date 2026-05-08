## Problema

O gráfico mostra `dez./25` mesmo sem transações nesse mês. A causa está em `src/lib/metricsCalculator.ts`, na construção de `monthlyData`:

```ts
month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' })
```

`new Date('2026-01-01')` é interpretado como UTC e convertido para o fuso local — em fusos negativos (ex.: BRT, UTC-3) vira `31/12/2025 21:00`, gerando o rótulo `dez.`. Como o agrupamento (`monthKey = transaction_date.substring(0,7)`) já está correto, **não existem meses fantasmas** — apenas o **rótulo** está deslocado.

Confirmação: `transaction_date` no banco é `YYYY-MM-DD`, agrupado por substring (sem timezone), então a lista de meses está certa. O bug é puramente de formatação do label.

## Correção

Arquivo único: `src/lib/metricsCalculator.ts`

Trocar a construção do label por um parser local-safe (sem `new Date(isoString)`), mantendo:
- agrupamento por `YYYY-MM` (já correto)
- ordenação cronológica (já correta)
- corte dos últimos 6 meses (preservar comportamento atual do dashboard)
- formato `mmm/aa` (ex.: `jan/26`) usando `date-fns` + `ptBR`, conforme padrão pedido

Implementação:

```ts
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// dentro do map final:
const [year, month] = monthKey.split('-').map(Number);
const localDate = new Date(year, month - 1, 1); // construção local-safe
return {
  month: format(localDate, 'MMM/yy', { locale: ptBR }),
  ...data,
};
```

`new Date(year, monthIndex, day)` usa horário local (não UTC), eliminando o deslocamento. `date-fns` já é usado no projeto, então não há nova dependência.

## Por que não criar `buildMonthlyChartData` separado

A lógica de agrupamento mensal já vive em `calculateMetrics` (consumida por `metrics` e `overallMetrics` no `TransactionsContext`). Duplicar em outro helper criaria duas fontes de verdade. A correção mínima e correta é ajustar o label dentro de `calculateMetrics`.

## Validação

- Confirmar no preview (fuso BRT) que `dez./25` desaparece e o gráfico começa em `jan/26`.
- Verificar console: nenhum erro de import.
- Cenários: sem transações → componente já mostra "Nenhuma transação registrada"; só receitas / só despesas → barras renderizam normalmente (já suportado).

## Escopo

- Editar: `src/lib/metricsCalculator.ts` (apenas o trecho de `monthlyData`).
- Não alterar: `MonthlyChart.tsx`, `TransactionsContext.tsx`, `dateUtils.ts`.