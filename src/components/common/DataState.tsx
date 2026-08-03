import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/EmptyState';
import type { LucideIcon } from 'lucide-react';

interface DataStateProps {
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Quantidade de linhas de skeleton exibidas no carregamento. */
  skeletonRows?: number;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Padroniza os três estados de qualquer módulo: carregando, erro e vazio.
 * Usa exclusivamente tokens semânticos do design system atual.
 */
export function DataState({
  loading,
  error,
  isEmpty,
  onRetry,
  skeletonRows = 3,
  emptyIcon,
  emptyTitle = 'Nada por aqui ainda',
  emptyDescription = 'Quando houver dados, eles aparecerão nesta área.',
  emptyActions,
  children,
}: DataStateProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <p className="text-destructive font-medium mb-1">Não foi possível carregar estas informações</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon ?? Inbox}
        title={emptyTitle}
        description={emptyDescription}
        actions={emptyActions}
      />
    );
  }

  return <>{children}</>;
}
