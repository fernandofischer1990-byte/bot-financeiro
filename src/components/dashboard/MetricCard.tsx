import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'income' | 'expense' | 'investment' | 'networth';
  subtitle?: string;
  trend?: { value: number; label?: string } | null;
  format?: 'currency' | 'percent' | 'number';
  className?: string;
}

function fmt(value: number, type: MetricCardProps['format']) {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'number') return value.toLocaleString('pt-BR');
  return formatCurrency(value);
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  subtitle,
  trend,
  format = 'currency',
  className,
}: MetricCardProps) {
  const TrendIcon = trend && trend.value >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card
      className={cn(
        'group relative overflow-hidden border bg-gradient-to-br from-card to-card/50 hover:shadow-elegant transition-all duration-300 hover:-translate-y-0.5',
        className
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 opacity-80',
          variant === 'income' && 'bg-success',
          variant === 'expense' && 'bg-destructive',
          variant === 'investment' && 'bg-primary',
          variant === 'networth' && 'gradient-primary',
          variant === 'default' && 'bg-accent'
        )}
      />
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p
              className={cn(
                'text-2xl font-bold tracking-tight truncate',
                variant === 'income' && 'text-success',
                variant === 'expense' && 'text-destructive',
                variant === 'investment' && 'text-primary',
                variant === 'networth' && 'text-primary'
              )}
            >
              {fmt(value, format)}
            </p>
            {(subtitle || trend) && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                {trend && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded',
                      trend.value >= 0 ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {trend.value >= 0 ? '+' : ''}
                    {trend.value.toFixed(1)}%
                  </span>
                )}
                {subtitle && <span className="text-muted-foreground truncate">{subtitle}</span>}
              </div>
            )}
          </div>
          <div
            className={cn(
              'p-2.5 rounded-xl shrink-0',
              variant === 'default' && 'bg-accent/10 text-accent',
              variant === 'income' && 'bg-success/10 text-success',
              variant === 'expense' && 'bg-destructive/10 text-destructive',
              variant === 'investment' && 'bg-primary/10 text-primary',
              variant === 'networth' && 'gradient-primary text-primary-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
