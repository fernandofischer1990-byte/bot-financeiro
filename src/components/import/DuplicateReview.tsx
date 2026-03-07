import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Copy, CheckCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { ImportRow, getDuplicateCounts } from '@/lib/duplicateDetector';
import { formatCurrency, formatDate } from '@/lib/constants';

interface DuplicateReviewProps {
  rows: ImportRow[];
  onRowsChange: (rows: ImportRow[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function DuplicateReview({ rows, onRowsChange, onConfirm, onBack }: DuplicateReviewProps) {
  const counts = getDuplicateCounts(rows);
  const hasIssues = counts.duplicate > 0 || counts.possible > 0;

  const toggleRow = (id: string, selected: boolean) => {
    onRowsChange(rows.map(r => r.id === id ? { ...r, selected } : r));
  };

  const selectAllUnique = () => {
    onRowsChange(rows.map(r => ({ ...r, selected: r.duplicateStatus !== 'duplicate' })));
  };

  const selectAll = () => {
    onRowsChange(rows.map(r => ({ ...r, selected: true })));
  };

  const selectedCount = rows.filter(r => r.selected).length;

  const statusBadge = (status: ImportRow['duplicateStatus']) => {
    if (status === 'duplicate') {
      return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"><Copy className="h-3 w-3 mr-1" />Duplicada</Badge>;
    }
    if (status === 'possible') {
      return <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30"><AlertTriangle className="h-3 w-3 mr-1" />Possível</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />Única</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">Únicas</p>
          <p className="font-semibold text-success">{counts.unique}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Possíveis</p>
          <p className="font-semibold text-warning">{counts.possible}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Duplicadas</p>
          <p className="font-semibold text-destructive">{counts.duplicate}</p>
        </div>
      </div>

      {hasIssues && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAllUnique} className="text-xs">
            Selecionar apenas únicas
          </Button>
          <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
            Selecionar todas
          </Button>
        </div>
      )}

      {!hasIssues && (
        <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg text-sm text-success">
          <CheckCircle className="h-4 w-4" />
          Nenhuma duplicata encontrada!
        </div>
      )}

      <ScrollArea className="h-[280px] border rounded-lg">
        <div className="p-2 space-y-1.5">
          {rows.map(row => (
            <div
              key={row.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-sm ${
                row.duplicateStatus === 'duplicate'
                  ? 'bg-destructive/5 border-destructive/20'
                  : row.duplicateStatus === 'possible'
                  ? 'bg-warning/5 border-warning/20'
                  : 'bg-background border-border'
              } ${!row.selected ? 'opacity-50' : ''}`}
            >
              <Checkbox
                checked={row.selected}
                onCheckedChange={(c) => toggleRow(row.id, !!c)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {row.type === 'income' ? (
                    <ArrowUpCircle className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  ) : (
                    <ArrowDownCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  )}
                  <span className={`font-medium ${row.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(row.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(row.date)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{row.description}</p>
              </div>
              {statusBadge(row.duplicateStatus)}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">Voltar</Button>
        <Button onClick={onConfirm} className="flex-1" disabled={selectedCount === 0}>
          Continuar com {selectedCount} transações
        </Button>
      </div>
    </div>
  );
}
