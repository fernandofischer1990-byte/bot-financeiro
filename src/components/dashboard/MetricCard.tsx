import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'income' | 'expense' | 'investment' | 'networth';
  className?: string;
}

export function MetricCard({ title, value, icon: Icon, variant = 'default', className }: MetricCardProps) {
  return (
    <Card className={cn('shadow-sm hover:shadow-md transition-shadow', className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn(
              'text-2xl font-bold tracking-tight',
              variant === 'income' && 'text-success',
              variant === 'expense' && 'text-destructive',
              variant === 'investment' && 'text-primary',
              variant === 'networth' && 'text-accent',
            )}>
              {formatCurrency(value)}
            </p>
          </div>
          <div className={cn(
            'p-3 rounded-xl',
            variant === 'default' && 'bg-primary/10 text-primary',
            variant === 'income' && 'bg-success/10 text-success',
            variant === 'expense' && 'bg-destructive/10 text-destructive',
            variant === 'investment' && 'bg-primary/10 text-primary',
            variant === 'networth' && 'bg-accent/10 text-accent',
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
