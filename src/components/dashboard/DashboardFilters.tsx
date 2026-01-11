import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, CalendarIcon, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ALL_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface FilterState {
  period: 'all' | 'today' | 'week' | 'month' | '3months' | 'custom';
  type: 'all' | 'income' | 'expense';
  category: string;
  startDate: Date | null;
  endDate: Date | null;
}

interface DashboardFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: '3months', label: 'Últimos 3 meses' },
  { value: 'custom', label: 'Personalizado' },
];

export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const handlePeriodChange = (period: FilterState['period']) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (period) {
      case 'today':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { locale: ptBR });
        endDate = endOfWeek(now, { locale: ptBR });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case '3months':
        startDate = startOfMonth(subMonths(now, 2));
        endDate = endOfMonth(now);
        break;
      case 'custom':
        setIsCustomOpen(true);
        return;
      default:
        startDate = null;
        endDate = null;
    }

    onFiltersChange({ ...filters, period, startDate, endDate });
  };

  const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onFiltersChange({
        ...filters,
        period: 'custom',
        startDate: startOfDay(range.from),
        endDate: endOfDay(range.to),
      });
      setIsCustomOpen(false);
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      period: 'all',
      type: 'all',
      category: 'all',
      startDate: null,
      endDate: null,
    });
  };

  const hasActiveFilters = 
    filters.period !== 'all' || 
    filters.type !== 'all' || 
    filters.category !== 'all';

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          {/* Period Filter */}
          <Select 
            value={filters.period} 
            onValueChange={(v) => handlePeriodChange(v as FilterState['period'])}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Date Picker */}
          {filters.period === 'custom' && (
            <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {filters.startDate && filters.endDate ? (
                    `${format(filters.startDate, 'dd/MM')} - ${format(filters.endDate, 'dd/MM')}`
                  ) : (
                    'Selecionar datas'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: filters.startDate || undefined,
                    to: filters.endDate || undefined,
                  }}
                  onSelect={handleCustomDateSelect}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Type Filter */}
          <Select 
            value={filters.type} 
            onValueChange={(v) => onFiltersChange({ ...filters, type: v as FilterState['type'] })}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select 
            value={filters.category} 
            onValueChange={(v) => onFiltersChange({ ...filters, category: v })}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {ALL_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Active Filters Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filters.period !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {PERIOD_OPTIONS.find(p => p.value === filters.period)?.label}
                {filters.period === 'custom' && filters.startDate && filters.endDate && (
                  <span className="ml-1">
                    ({format(filters.startDate, 'dd/MM')} - {format(filters.endDate, 'dd/MM')})
                  </span>
                )}
              </Badge>
            )}
            {filters.type !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {filters.type === 'income' ? '↑ Receitas' : '↓ Despesas'}
              </Badge>
            )}
            {filters.category !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {ALL_CATEGORIES.find(c => c.value === filters.category)?.icon}{' '}
                {ALL_CATEGORIES.find(c => c.value === filters.category)?.label}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const defaultFilters: FilterState = {
  period: 'all',
  type: 'all',
  category: 'all',
  startDate: null,
  endDate: null,
};
