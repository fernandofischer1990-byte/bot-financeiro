import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Briefcase, TrendingUp, TrendingDown, Coins, Upload, Plus, Loader2 } from 'lucide-react';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { InvestmentImportWizard } from './InvestmentImportWizard';
import { InvestmentForm } from './InvestmentForm';
import { InvestmentsTable } from './InvestmentsTable';
import { InvestmentGroupChart } from './InvestmentGroupChart';
import { NetWorthChart } from '@/components/dashboard/NetWorthChart';
import { getInvestmentTypeLabel } from '@/lib/constants';

export function InvestmentsTab() {
  const { investments, totalInvested, totalInitial, profit, initialLoading } = useInvestmentsContext();
  const { overallMetrics } = useFinancialMetrics();
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Investimentos</h2>
          <p className="text-sm text-muted-foreground">Patrimônio segregado do saldo disponível.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar Planilha
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Investimento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Saldo Investido" value={totalInvested} icon={Briefcase} variant="investment" />
        <MetricCard title="Total Aportado" value={totalInitial} icon={Coins} variant="default" />
        <MetricCard title="Rentabilidade" value={profit} icon={profit >= 0 ? TrendingUp : TrendingDown} variant={profit >= 0 ? 'income' : 'expense'} />
        <MetricCard title="Patrimônio Total" value={overallMetrics.netWorth} icon={Coins} variant="networth" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InvestmentGroupChart groupBy="institution" title="Distribuição por Instituição" />
        <InvestmentGroupChart groupBy="investment_type" title="Distribuição por Tipo" labelFn={getInvestmentTypeLabel} />
      </div>

      <NetWorthChart data={overallMetrics.monthlyNetWorth} />

      <Card>
        <CardContent className="pt-6">
          {initialLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <InvestmentsTable />
          )}
        </CardContent>
      </Card>

      <InvestmentImportWizard open={importOpen} onOpenChange={setImportOpen} />
      <InvestmentForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
