import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/hooks/useTransactions';
import { formatCurrency, formatDate, getCategoryLabel, getCategoryIcon } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  maxItems?: number;
}

export function TransactionList({ transactions, onDelete, maxItems = 10 }: TransactionListProps) {
  const displayTransactions = transactions.slice(0, maxItems);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {displayTransactions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma transação registrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border">
              {displayTransactions.map((tx) => (
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
                        {tx.description || 'Sem descrição'} • {formatDate(tx.transaction_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'font-semibold',
                      tx.type === 'income' ? 'text-success' : 'text-destructive'
                    )}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </span>
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
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
