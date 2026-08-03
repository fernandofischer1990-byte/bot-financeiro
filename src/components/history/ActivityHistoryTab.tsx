import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DataState } from '@/components/common/DataState';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { translateError, MESSAGES } from '@/lib/feedback';
import {
  fetchActivityLog, type ActivityLogEntry, type ActivityAction, type ActivityEntity,
} from '@/services/activityLogService';
import { History, RefreshCw, Download, Search, Plus, Pencil, Trash2, Upload } from 'lucide-react';

const ACTION_LABEL: Record<string, string> = {
  create: 'Criação',
  update: 'Edição',
  delete: 'Exclusão',
  import: 'Importação',
  bulk_delete: 'Exclusão em massa',
};

const ENTITY_LABEL: Record<string, string> = {
  transaction: 'Transação',
  investment: 'Investimento',
};

const SOURCE_LABEL: Record<string, string> = {
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function toCsv(rows: Array<Record<string, string>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(','))].join('\n');
}

export function ActivityHistoryTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<ActivityEntity | 'all'>('all');
  const [action, setAction] = useState<ActivityAction | 'all'>('all');
  const [days, setDays] = useState<'7' | '30' | '90' | 'all'>('30');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: err } = await fetchActivityLog(user.id, {
      entity,
      action,
      days: days === 'all' ? 'all' : Number(days),
    });
    if (err) {
      setError(translateError(err));
    } else {
      setEntries(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, [user, entity, action, days]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      (e.label ?? '').toLowerCase().includes(q) ||
      ENTITY_LABEL[e.entity]?.toLowerCase().includes(q) ||
      ACTION_LABEL[e.action]?.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const exportCsv = () => {
    if (visible.length === 0) {
      toast({ title: MESSAGES.export.empty, variant: 'destructive' });
      return;
    }
    const rows = visible.map((e) => ({
      data_hora: formatDateTime(e.created_at),
      acao: ACTION_LABEL[e.action] ?? e.action,
      entidade: ENTITY_LABEL[e.entity] ?? e.entity,
      origem: SOURCE_LABEL[e.source] ?? e.source,
      descricao: e.label ?? '',
      id_registro: e.entity_id ?? '',
    }));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: MESSAGES.export.done, description: `${rows.length} registros em CSV.` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Histórico de atividades</h2>
          <p className="text-sm text-muted-foreground">
            Tudo o que foi criado, editado ou excluído — pelo app, pela importação, pelo assistente ou por integrações.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Registros
          </CardTitle>
          <CardDescription>Filtre por período, tipo de registro e ação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar no histórico"
                className="pl-9"
                aria-label="Buscar no histórico"
              />
            </div>
            <Select value={days} onValueChange={(v) => setDays(v as typeof days)}>
              <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entity} onValueChange={(v) => setEntity(v as typeof entity)}>
              <SelectTrigger aria-label="Tipo de registro"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os registros</SelectItem>
                <SelectItem value="transaction">Transações</SelectItem>
                <SelectItem value="investment">Investimentos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
              <SelectTrigger aria-label="Ação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Edição</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="import">Importação</SelectItem>
                <SelectItem value="bulk_delete">Exclusão em massa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataState
            loading={loading}
            error={error}
            isEmpty={visible.length === 0}
            onRetry={load}
            skeletonRows={5}
            emptyIcon={History}
            emptyTitle="Nenhuma atividade registrada"
            emptyDescription="As próximas movimentações que você fizer aparecerão aqui com data, origem e detalhes."
          >
            <ul className="divide-y">
              {visible.map((e) => {
                const Icon = actionIcon(e.action);
                return (
                  <li key={e.id} className="flex items-start gap-3 py-3">
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
                      {e.label && (
                        <p className="text-sm text-muted-foreground break-words">{e.label}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(e.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
