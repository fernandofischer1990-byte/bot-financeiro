import { useState, useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Search } from 'lucide-react';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { Investment } from '@/types/investment';
import { formatCurrency, getInvestmentTypeLabel, getInvestmentTypeIcon } from '@/lib/constants';
import { InvestmentForm } from './InvestmentForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function InvestmentsTable() {
  const { investments, deleteInvestment } = useInvestmentsContext();
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return investments;
    return investments.filter(i =>
      i.investment_name.toLowerCase().includes(q) ||
      (i.institution || '').toLowerCase().includes(q) ||
      i.investment_type.toLowerCase().includes(q)
    );
  }, [investments, query]);

  if (investments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum investimento registrado. Importe uma planilha ou clique em <strong>+ Novo</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, instituição…" className="pl-9" />
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investimento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Instituição</TableHead>
              <TableHead className="text-right">Aplicado</TableHead>
              <TableHead className="text-right">Saldo Atual</TableHead>
              <TableHead className="text-right">Rentab.</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(inv => {
              const profit = Number(inv.current_balance) - Number(inv.initial_amount);
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium max-w-[280px] truncate" title={inv.investment_name}>
                    <span className="mr-1.5">{getInvestmentTypeIcon(inv.investment_type)}</span>
                    {inv.investment_name}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{getInvestmentTypeLabel(inv.investment_type)}</Badge></TableCell>
                  <TableCell className="text-sm">{inv.institution || '—'}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(inv.initial_amount))}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(Number(inv.current_balance))}</TableCell>
                  <TableCell className={`text-right text-sm ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.end_date || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(inv)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(inv)} className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && <InvestmentForm open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir investimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>{deleting?.investment_name}</strong> do seu patrimônio. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleting) deleteInvestment(deleting.id); setDeleting(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
