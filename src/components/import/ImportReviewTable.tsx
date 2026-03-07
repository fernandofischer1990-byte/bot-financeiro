import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { ImportRow } from '@/lib/duplicateDetector';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatCurrency, formatDate } from '@/lib/constants';
import { getCategoryConfidence } from '@/lib/categoryMapping';

interface ImportReviewTableProps {
  rows: ImportRow[];
  onRowsChange: (rows: ImportRow[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function ImportReviewTable({ rows, onRowsChange, onConfirm, onBack }: ImportReviewTableProps) {
  const selectedRows = rows.filter(r => r.selected);
  const totalIncome = selectedRows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpenses = selectedRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const toggleRow = (id: string) => {
    onRowsChange(rows.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const removeRow = (id: string) => {
    onRowsChange(rows.filter(r => r.id !== id));
  };

  const changeCategory = (id: string, category: string) => {
    onRowsChange(rows.map(r => r.id === id ? { ...r, category } : r));
  };

  const getCategories = (type: 'income' | 'expense') =>
    type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const getConfidenceColor = (description: string, category: string) => {
    const confidence = getCategoryConfidence(description, category);
    return confidence === 'high' ? 'bg-success/20 text-success' :
           confidence === 'medium' ? 'bg-warning/20 text-warning' :
           'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">Selecionadas</p>
          <p className="font-semibold">{selectedRows.length} de {rows.length}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Receitas</p>
          <p className="font-semibold text-success">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Despesas</p>
          <p className="font-semibold text-destructive">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      <ScrollArea className="h-[320px] border rounded-lg">
        <div className="p-2 space-y-1.5">
          {rows.map(row => (
            <div
              key={row.id}
              className={`p-3 rounded-lg border transition-colors ${
                row.selected ? 'bg-background border-border' : 'bg-muted/30 border-transparent opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={row.selected}
                  onCheckedChange={() => toggleRow(row.id)}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    {row.type === 'income' ? (
                      <ArrowUpCircle className="h-4 w-4 text-success flex-shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <span className={`font-semibold text-sm ${row.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                      {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(row.date)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{row.description}</p>
                  <div className="flex items-center gap-2">
                    <Select value={row.category} onValueChange={(v) => changeCategory(row.id, v)}>
                      <SelectTrigger className="h-7 w-[180px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getCategories(row.type).map(cat => (
                          <SelectItem key={cat.value} value={cat.value} className="text-xs">
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className={`text-[10px] ${getConfidenceColor(row.description, row.category)}`}>
                      {getCategoryConfidence(row.description, row.category) === 'high' ? 'Alta' :
                       getCategoryConfidence(row.description, row.category) === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(row.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">Voltar</Button>
        <Button onClick={onConfirm} className="flex-1" disabled={selectedRows.length === 0}>
          Confirmar {selectedRows.length} transações
        </Button>
      </div>
    </div>
  );
}
