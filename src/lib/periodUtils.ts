import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  subMonths, subQuarters,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodKey =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'last_quarter'
  | '3months'
  | 'custom';

export interface PeriodRange {
  start: Date | null;
  end: Date | null;
  label: string;
}

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'all', label: 'Todo período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'last_quarter', label: 'Trimestre anterior' },
  { value: '3months', label: 'Últimos 3 meses' },
  { value: 'custom', label: 'Personalizado' },
];

export function getPeriodLabel(period: PeriodKey): string {
  return PERIOD_OPTIONS.find(p => p.value === period)?.label ?? 'Todo período';
}

export function getPeriodRange(
  period: PeriodKey,
  customStart?: Date | null,
  customEnd?: Date | null,
): PeriodRange {
  const now = new Date();

  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: 'Hoje' };
    case 'week': {
      const start = startOfWeek(now, { locale: ptBR });
      const end = endOfWeek(now, { locale: ptBR });
      return { start, end, label: 'Esta semana' };
    }
    case 'month': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return {
        start, end,
        label: `Este mês (${format(start, "MMMM 'de' yyyy", { locale: ptBR })})`,
      };
    }
    case 'quarter': {
      const start = startOfQuarter(now);
      const end = endOfQuarter(now);
      return {
        start, end,
        label: `Este trimestre (${format(start, 'dd/MM', { locale: ptBR })} – ${format(end, 'dd/MM/yyyy', { locale: ptBR })})`,
      };
    }
    case 'last_quarter': {
      const ref = subQuarters(now, 1);
      const start = startOfQuarter(ref);
      const end = endOfQuarter(ref);
      return {
        start, end,
        label: `Trimestre anterior (${format(start, 'dd/MM', { locale: ptBR })} – ${format(end, 'dd/MM/yyyy', { locale: ptBR })})`,
      };
    }
    case '3months': {
      const start = startOfMonth(subMonths(now, 2));
      const end = endOfMonth(now);
      return { start, end, label: 'Últimos 3 meses' };
    }
    case 'custom': {
      if (customStart && customEnd) {
        const start = startOfDay(customStart);
        const end = endOfDay(customEnd);
        return {
          start, end,
          label: `Personalizado (${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')})`,
        };
      }
      return { start: null, end: null, label: 'Personalizado' };
    }
    default:
      return { start: null, end: null, label: 'Todo período' };
  }
}
