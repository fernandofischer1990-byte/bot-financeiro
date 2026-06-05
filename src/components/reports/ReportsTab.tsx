import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { formatCurrency } from '@/lib/constants';
import { Download, Flame, Target, TrendingUp, FileText, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsTab() {
  const { transactions } = useTransactionsContext();
  const { investments } = useInvestmentsContext();
  const { overallMetrics } = useFinancialMetrics();
  const { toast } = useToast();

  const streak = useMemo(() => {
    if (transactions.length === 0) return 0;
    const days = new Set(transactions.map((t) => t.transaction_date));
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [transactions]);

  const savingsGoal = 10000;
  const savingsProgress = Math.min(100, (overallMetrics.netWorth / savingsGoal) * 100);

  const monthly = overallMetrics.monthlyData;
  const lastMonth = monthly[monthly.length - 1];
  const monthSavings = lastMonth ? lastMonth.income - lastMonth.expenses : 0;

  const exportCSV = (type: 'transactions' | 'investments') => {
    if (type === 'transactions') {
      if (transactions.length === 0) {
        toast({ title: 'Sem dados', description: 'Nenhuma transação para exportar.', variant: 'destructive' });
        return;
      }
      const rows = transactions.map((t) => ({
        data: t.transaction_date,
        tipo: t.type,
        categoria: t.category,
        descricao: t.description ?? '',
        valor: t.amount,
        escopo: t.financial_scope,
        instituicao: t.institution ?? '',
      }));
      downloadFile(`transacoes-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv');
      toast({ title: '✅ Exportado', description: `${rows.length} transações em CSV.` });
    } else {
      if (investments.length === 0) {
        toast({ title: 'Sem dados', description: 'Nenhum investimento para exportar.', variant: 'destructive' });
        return;
      }
      const rows = investments.map((i) => ({
        nome: i.investment_name,
        tipo: i.investment_type,
        instituicao: i.institution ?? '',
        aporte_inicial: i.initial_amount,
        data_inicio: i.start_date ?? '',
        data_fim: i.end_date ?? '',
      }));
      downloadFile(`investimentos-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv');
      toast({ title: '✅ Exportado', description: `${rows.length} investimentos em CSV.` });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Relatórios & Metas</h2>
        <p className="text-sm text-muted-foreground">Exporte seus dados e acompanhe suas conquistas financeiras.</p>
      </div>

      {/* Gamificação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-warning mb-2">
              <Flame className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Sequência</span>
            </div>
            <p className="text-3xl font-bold">{streak} <span className="text-base font-normal text-muted-foreground">dias</span></p>
            <p className="text-xs text-muted-foreground mt-1">consecutivos com registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-success mb-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Economia do mês</span>
            </div>
            <p className={`text-3xl font-bold ${monthSavings >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(monthSavings)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{lastMonth?.month ?? 'sem dados'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Target className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Meta de patrimônio</span>
            </div>
            <p className="text-3xl font-bold">{savingsProgress.toFixed(0)}%</p>
            <Progress value={savingsProgress} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(overallMetrics.netWorth)} de {formatCurrency(savingsGoal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Exportações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Exportar dados
          </CardTitle>
          <CardDescription>Baixe seus registros para análise externa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => exportCSV('transactions')} className="justify-start">
              <Download className="h-4 w-4 mr-2" />
              Transações (CSV)
            </Button>
            <Button variant="outline" onClick={() => exportCSV('investments')} className="justify-start">
              <Download className="h-4 w-4 mr-2" />
              Investimentos (CSV)
            </Button>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="w-full justify-start">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
          <p className="text-xs text-muted-foreground">
            Para PDF, use o atalho de impressão e selecione "Salvar como PDF" no destino.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
