import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Transaction } from '@/contexts/TransactionsContext';
import { formatCurrency, formatDate, getCategoryLabel, getCategoryIcon } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Trash2, ArrowUpCircle, ArrowDownCircle, Pencil, ArrowUpDown } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
  maxItems?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

type SortOrder = 'newest' | 'oldest';

function getDateGroupLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "d 'de' MMMM", { locale: ptBR });
}

export function TransactionList({ 
  transactions, 
  onDelete, 
  onEdit, 
  maxItems = 10,
  hasActiveFilters = false,
  onClearFilters 
}: TransactionListProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.transaction_date).getTime();
    const dateB = new Date(b.transaction_date).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const displayTransactions = sortedTransactions.slice(0, maxItems);

  // Group transactions by date
  const groupedTransactions = displayTransactions.reduce((groups, tx) => {
    const dateKey = tx.transaction_date;
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(tx);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const sortedDateKeys = Object.keys(groupedTransactions).sort((a, b) => {
    return sortOrder === 'newest' 
      ? new Date(b).getTime() - new Date(a).getTime()
      : new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Transações Recentes</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayTransactions.length === 0 ? (
          <div className="p-6 text-center">
            {hasActiveFilters ? (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Nenhuma transação encontrada com os filtros atuais
                </p>
                {onClearFilters && (
                  <Button variant="outline" size="sm" onClick={onClearFilters}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma transação encontrada</p>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border">
              {sortedDateKeys.map((dateKey) => (
                <div key={dateKey}>
                  <div className="px-4 py-2 bg-muted/30 sticky top-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {getDateGroupLabel(dateKey)}
                    </span>
                  </div>
                  {groupedTransactions[dateKey].map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          tx.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'
                        )}>
                          {tx.type === 'income' ? (
                            <ArrowUpCircle className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCategoryIcon(tx.category)}</span>
                            <span className="font-medium text-sm">{getCategoryLabel(tx.category)}</span>
                            <Badge variant="outline" className="text-xs">
                              {tx.source === 'chat' ? 'Chat' : tx.source === 'upload' ? 'Upload' : 'Manual'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tx.description || 'Sem descrição'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-semibold',
                          tx.type === 'income' ? 'text-success' : 'text-destructive'
                        )}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                        </span>
                        {onEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => onEdit(tx)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(tx.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
