import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, FileText, ArrowUpCircle, ArrowDownCircle, Hash } from 'lucide-react';
import { ImportRow } from '@/lib/duplicateDetector';
import { formatCurrency } from '@/lib/constants';

interface ImportSummaryProps {
  rows: ImportRow[];
  fileName: string;
  fileFormat: string;
  totalParsed: number;
  duplicateCount: number;
  isImporting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ImportSummary({
  rows,
  fileName,
  fileFormat,
  totalParsed,
  duplicateCount,
  isImporting,
  onConfirm,
  onBack,
}: ImportSummaryProps) {
  const selectedRows = rows.filter(r => r.selected);
  const income = selectedRows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expenses = selectedRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const skipped = totalParsed - selectedRows.length;

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Pronto para importar!</h3>
        <p className="text-sm text-muted-foreground">Revise o resumo abaixo e confirme</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Arquivo:</span>
            <span className="font-medium truncate">{fileName}</span>
            <span className="text-xs text-muted-foreground uppercase">{fileFormat}</span>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total lido:</span>
              <span className="font-medium">{totalParsed}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">A importar:</span>
              <span className="font-medium text-success">{selectedRows.length}</span>
            </div>
          </div>

          {duplicateCount > 0 && (
            <div className="text-xs text-muted-foreground">
              {duplicateCount} duplicata(s) detectada(s) · {skipped} ignorada(s)
            </div>
          )}

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">Receitas:</span>
              <span className="font-medium text-success">{formatCurrency(income)}</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">Despesas:</span>
              <span className="font-medium text-destructive">{formatCurrency(expenses)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={isImporting}>
          Voltar
        </Button>
        <Button onClick={onConfirm} className="flex-1" disabled={isImporting || selectedRows.length === 0}>
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Importando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Importar {selectedRows.length} transações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
