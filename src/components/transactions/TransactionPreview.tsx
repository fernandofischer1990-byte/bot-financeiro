import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpCircle, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatCurrency, formatDate } from '@/lib/constants';
import { getCategoryConfidence } from '@/lib/categoryMapping';

export interface ExtractedTransaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  suggestedCategory: string;
  selected: boolean;
}

interface TransactionPreviewProps {
  transactions: ExtractedTransaction[];
  onTransactionsChange: (transactions: ExtractedTransaction[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
  summary?: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
  };
}

export function TransactionPreview({
  transactions,
  onTransactionsChange,
  onConfirm,
  onCancel,
  isImporting,
  summary
}: TransactionPreviewProps) {
  const [selectAll, setSelectAll] = useState(true);

  const selectedCount = transactions.filter(t => t.selected).length;
  const selectedIncome = transactions
    .filter(t => t.selected && t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const selectedExpenses = transactions
    .filter(t => t.selected && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    onTransactionsChange(transactions.map(t => ({ ...t, selected: checked })));
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    onTransactionsChange(
      transactions.map(t => t.id === id ? { ...t, selected: checked } : t)
    );
  };

  const handleCategoryChange = (id: string, category: string) => {
    onTransactionsChange(
      transactions.map(t => t.id === id ? { ...t, suggestedCategory: category } : t)
    );
  };

  const getCategories = (type: 'income' | 'expense') => {
    return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  };

  const getConfidenceBadge = (transaction: ExtractedTransaction) => {
    const confidence = getCategoryConfidence(transaction.description, transaction.suggestedCategory);
    const colors = {
      high: 'bg-success/20 text-success border-success/30',
      medium: 'bg-warning/20 text-warning border-warning/30',
      low: 'bg-muted text-muted-foreground border-muted'
    };
    return (
      <Badge variant="outline" className={`text-xs ${colors[confidence]}`}>
        {confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Média' : 'Baixa'}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold">{summary.totalTransactions} transações</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Receitas</p>
            <p className="font-semibold text-success">{formatCurrency(summary.totalIncome)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Despesas</p>
            <p className="font-semibold text-destructive">{formatCurrency(summary.totalExpenses)}</p>
          </div>
        </div>
      )}

      {/* Select All */}
      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectAll && selectedCount === transactions.length}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
            Selecionar todas ({transactions.length})
          </label>
        </div>
        <div className="text-xs text-muted-foreground">
          {selectedCount} selecionadas
        </div>
      </div>

      {/* Transaction List */}
      <ScrollArea className="h-[300px] border rounded-lg">
        <div className="p-2 space-y-2">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className={`p-3 rounded-lg border transition-colors ${
                transaction.selected 
                  ? 'bg-background border-primary/30' 
                  : 'bg-muted/30 border-transparent opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={transaction.selected}
                  onCheckedChange={(checked) => handleSelectOne(transaction.id, !!checked)}
                />
                
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    {transaction.type === 'income' ? (
                      <ArrowUpCircle className="h-4 w-4 text-success flex-shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <span className={`font-semibold ${
                      transaction.type === 'income' ? 'text-success' : 'text-destructive'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(transaction.date)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground truncate" title={transaction.description}>
                    {transaction.description}
                  </p>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={transaction.suggestedCategory}
                      onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                    >
                      <SelectTrigger className="h-7 w-[180px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getCategories(transaction.type).map((cat) => (
                          <SelectItem key={cat.value} value={cat.value} className="text-xs">
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getConfidenceBadge(transaction)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Selected Summary */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg text-sm">
        <div>
          <span className="font-medium">{selectedCount} transações selecionadas</span>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="text-success">+{formatCurrency(selectedIncome)}</span>
            <span className="text-destructive">-{formatCurrency(selectedExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isImporting}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} className="flex-1" disabled={isImporting || selectedCount === 0}>
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Importando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Importar {selectedCount} transações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
