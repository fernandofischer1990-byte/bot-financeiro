import type { Transaction } from '@/types/finance';
import type { Investment } from '@/types/investment';
import type {
  BemDireitoItem,
  IrpfReport,
  PagamentoEfetuadoItem,
  RendimentoIsentoItem,
  RendimentoTributavelItem,
} from '@/types/irpf';

/**
 * Motor do relatório anual de IRPF.
 *
 * Consome exclusivamente os metadados fiscais já persistidos
 * (`taxId`, `irpfCategory` em transações; `custodianCnpj` em investimentos)
 * e agrupa por ficha da declaração. Nunca cria datas artificiais: o
 * ano-calendário é decidido pelo prefixo textual de `transaction_date`.
 */

/** Fichas suportadas por `irpfCategory`. */
export type IrpfSheet =
  | 'bens_direitos'
  | 'rendimento_isento'
  | 'rendimento_tributavel'
  | 'pagamento_efetuado';

/** Mapeia `irpfCategory` (código ou rótulo livre) para a ficha correspondente. */
function sheetFor(tx: Transaction): IrpfSheet | null {
  const raw = tx.irpfCategory?.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('bem') || raw.includes('direito')) return 'bens_direitos';
  if (raw.includes('isent') || raw.includes('não tribut') || raw.includes('nao tribut')) return 'rendimento_isento';
  if (raw.includes('tribut')) return 'rendimento_tributavel';
  if (raw.includes('pagamento') || raw.includes('dedu')) return 'pagamento_efetuado';
  // Fallback pelo tipo da transação quando a categoria fiscal é apenas um código.
  if (tx.type === 'income') return 'rendimento_tributavel';
  if (tx.type === 'expense') return 'pagamento_efetuado';
  return 'bens_direitos';
}

const yearOf = (isoDate: string | null | undefined) =>
  isoDate && isoDate.length >= 4 ? Number(isoDate.slice(0, 4)) : null;

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export function buildIrpfReport(
  transactions: Transaction[],
  investments: Investment[],
  calendarYear: number
): IrpfReport {
  const inYear = transactions.filter(
    (t) => t.irpfCategory && yearOf(t.transaction_date) === calendarYear
  );

  const isentos: RendimentoIsentoItem[] = [];
  const tributaveis: RendimentoTributavelItem[] = [];
  const pagamentos: PagamentoEfetuadoItem[] = [];

  for (const tx of inYear) {
    const sheet = sheetFor(tx);
    const amount = Number(tx.amount);
    const label = tx.description?.trim() || tx.category;

    if (sheet === 'rendimento_isento') {
      isentos.push({
        code: tx.irpfCategory ?? '',
        sourceName: label,
        sourceTaxId: tx.taxId ?? undefined,
        amount,
      });
    } else if (sheet === 'rendimento_tributavel') {
      tributaveis.push({
        sourceName: label,
        sourceTaxId: tx.taxId ?? undefined,
        amount,
        withheldTax: 0,
      });
    } else if (sheet === 'pagamento_efetuado') {
      pagamentos.push({
        code: tx.irpfCategory ?? '',
        beneficiaryName: label,
        beneficiaryTaxId: tx.taxId ?? undefined,
        amount,
      });
    }
  }

  // Bens e Direitos: posições custodiadas com saldo no ano-calendário.
  const bens: BemDireitoItem[] = investments
    .filter((inv) => {
      const start = yearOf(inv.start_date);
      return start === null || start <= calendarYear;
    })
    .map((inv) => {
      const acquiredThisYear = yearOf(inv.start_date) === calendarYear;
      const current = Number(inv.initial_amount) || 0;
      return {
        code: inv.investment_type,
        description: inv.institution ? `${inv.investment_name} — ${inv.institution}` : inv.investment_name,
        taxId: inv.custodianCnpj ?? undefined,
        situacaoAnterior: acquiredThisYear ? 0 : current,
        situacaoAtual: current,
      };
    });

  return {
    calendarYear,
    generatedAt: new Date().toISOString(),
    bensEDireitos: { calendarYear, total: sum(bens.map((b) => b.situacaoAtual)), items: bens },
    rendimentosIsentos: { calendarYear, total: sum(isentos.map((i) => i.amount)), items: isentos },
    rendimentosTributaveis: {
      calendarYear,
      total: sum(tributaveis.map((i) => i.amount)),
      items: tributaveis,
    },
    pagamentosEfetuados: { calendarYear, total: sum(pagamentos.map((i) => i.amount)), items: pagamentos },
  };
}

/** Linhas planas do relatório, prontas para exportação em CSV. */
export function irpfReportRows(report: IrpfReport): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = [];

  for (const b of report.bensEDireitos.items) {
    rows.push({
      ficha: 'Bens e Direitos',
      codigo: b.code,
      descricao: b.description,
      cpf_cnpj: b.taxId ?? '',
      situacao_anterior: b.situacaoAnterior,
      situacao_atual: b.situacaoAtual,
    });
  }
  for (const i of report.rendimentosIsentos.items) {
    rows.push({
      ficha: 'Rendimentos Isentos',
      codigo: i.code,
      descricao: i.sourceName,
      cpf_cnpj: i.sourceTaxId ?? '',
      situacao_anterior: '',
      situacao_atual: i.amount,
    });
  }
  for (const i of report.rendimentosTributaveis.items) {
    rows.push({
      ficha: 'Rendimentos Tributáveis',
      codigo: '',
      descricao: i.sourceName,
      cpf_cnpj: i.sourceTaxId ?? '',
      situacao_anterior: '',
      situacao_atual: i.amount,
    });
  }
  for (const p of report.pagamentosEfetuados.items) {
    rows.push({
      ficha: 'Pagamentos Efetuados',
      codigo: p.code,
      descricao: p.beneficiaryName,
      cpf_cnpj: p.beneficiaryTaxId ?? '',
      situacao_anterior: '',
      situacao_atual: p.amount,
    });
  }

  return rows;
}
