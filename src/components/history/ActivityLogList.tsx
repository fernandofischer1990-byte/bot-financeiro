import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import type { ActivityLogEntry } from '@/services/activityLogService';

export const ACTION_LABEL: Record<string, string> = {
  create: 'Criação',
  update: 'Edição',
  delete: 'Exclusão',
  import: 'Importação',
  bulk_delete: 'Exclusão em massa',
};

export const ENTITY_LABEL: Record<string, string> = {
  transaction: 'Transação',
  investment: 'Investimento',
};

export const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual',
  chat: 'Assistente',
  upload: 'Importação',
  mcp: 'Integração',
  system: 'Sistema',
};

function actionIcon(action: string) {
  if (action === 'create') return Plus;
  if (action === 'update') return Pencil;
  if (action === 'import') return Upload;
  return Trash2;
}

function actionTone(action: string) {
  if (action === 'create' || action === 'import') return 'text-success';
  if (action === 'update') return 'text-primary';
  return 'text-destructive';
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

interface ActivityLogListProps {
  entries: ActivityLogEntry[];
}

/**
 * Lista virtualizada: renderiza apenas as linhas visíveis, mantendo o histórico
 * fluido mesmo com milhares de registros carregados por cursor.
 */
export function ActivityLogList({ entries }: ActivityLogListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  return (
    <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto" role="region" aria-label="Lista de atividades">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((row) => {
          const e = entries[row.index];
          const Icon = actionIcon(e.action);
          return (
            <div
              key={e.id}
              ref={virtualizer.measureElement}
              data-index={row.index}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <div className="flex items-start gap-3 py-3 border-b">
                <div className={`mt-0.5 shrink-0 ${actionTone(e.action)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">
                      {ACTION_LABEL[e.action] ?? e.action} · {ENTITY_LABEL[e.entity] ?? e.entity}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {SOURCE_LABEL[e.source] ?? e.source}
                    </Badge>
                  </div>
                  {e.label && <p className="text-sm text-muted-foreground break-words">{e.label}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(e.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
