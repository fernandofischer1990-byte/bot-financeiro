import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DataState } from '@/components/common/DataState';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { translateError, MESSAGES } from '@/lib/feedback';
import {
  fetchActivityLog, type ActivityLogEntry, type ActivityLogCursor,
  type ActivityAction, type ActivityEntity, type ActivitySource,
} from '@/services/activityLogService';
import { History, RefreshCw, Download, Search, Loader2, X } from 'lucide-react';
import { ActivityLogList, ACTION_LABEL, ENTITY_LABEL, SOURCE_LABEL, formatDateTime } from './ActivityLogList';

const PAGE_SIZE = 50;

/** Permite buscar em PT-BR ("criação", "assistente") mesmo com valores em inglês no banco. */
const PT_ALIASES: Record<string, string> = {
  criacao: 'create', criação: 'create', criado: 'create',
  edicao: 'update', edição: 'update', editado: 'update',
  exclusao: 'delete', exclusão: 'delete', excluido: 'delete', excluído: 'delete',
  importacao: 'import', importação: 'import',
  transacao: 'transaction', transação: 'transaction', transacoes: 'transaction',
  investimento: 'investment', investimentos: 'investment',
  assistente: 'chat', chatbot: 'chat',
  integracao: 'mcp', integração: 'mcp',
  sistema: 'system',
};

function normalizeSearch(term: string): string {
  const t = term.trim().toLowerCase();
  return PT_ALIASES[t] ?? t;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<ActivityLogCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [entity, setEntity] = useState<ActivityEntity | 'all'>('all');
  const [action, setAction] = useState<ActivityAction | 'all'>('all');
  const [source, setSource] = useState<ActivitySource | 'all'>('all');
  const [days, setDays] = useState<'7' | '30' | '90' | 'all'>('30');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce da busca (300ms) para não disparar consulta a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const reqRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    if (!user) return;
    const reqId = ++reqRef.current;
    setLoading(true);
    const page = await fetchActivityLog(user.id, {
      entity, action, source,
      days: days === 'all' ? 'all' : Number(days),
      search: normalizeSearch(debouncedSearch),
      pageSize: PAGE_SIZE,
    });
    if (reqId !== reqRef.current) return; // resposta obsoleta
    if (page.error) {
      setError(translateError(page.error));
    } else {
      setEntries(page.data);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setError(null);
    }
    setLoading(false);
  }, [user, entity, action, source, days, debouncedSearch]);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!user || !cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await fetchActivityLog(user.id, {
      entity, action, source,
      days: days === 'all' ? 'all' : Number(days),
      search: normalizeSearch(debouncedSearch),
      cursor,
      pageSize: PAGE_SIZE,
    });
    if (page.error) {
      toast({ title: 'Não foi possível carregar mais registros', description: translateError(page.error), variant: 'destructive' });
    } else {
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.data.filter((e) => !seen.has(e.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    }
    setLoadingMore(false);
  }, [user, cursor, loadingMore, entity, action, source, days, debouncedSearch, toast]);

  const exportCsv = () => {
    if (entries.length === 0) {
      toast({ title: MESSAGES.export.empty, variant: 'destructive' });
      return;
    }
    const rows = entries.map((e) => ({
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

  const clearFilters = () => {
    setEntity('all'); setAction('all'); setSource('all'); setDays('30'); setSearch('');
  };

  const filtersActive = entity !== 'all' || action !== 'all' || source !== 'all' || days !== '30' || search.trim() !== '';

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
          <Button variant="outline" size="sm" onClick={loadFirstPage}>
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
          <CardDescription>Busque por descrição e filtre por período, origem, tipo de registro e ação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="relative lg:col-span-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por descrição, valor, categoria ou ID do registro"
                className="pl-9 pr-9"
                aria-label="Buscar no histórico"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger aria-label="Origem"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="chat">Assistente</SelectItem>
                <SelectItem value="upload">Importação</SelectItem>
                <SelectItem value="mcp">Integração</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-start">
                <X className="h-4 w-4 mr-2" /> Limpar filtros
              </Button>
            )}
          </div>

          <DataState
            loading={loading}
            error={error}
            isEmpty={entries.length === 0}
            onRetry={loadFirstPage}
            skeletonRows={5}
            emptyIcon={History}
            emptyTitle="Nenhuma atividade encontrada"
            emptyDescription="Ajuste a busca ou os filtros — ou registre uma nova movimentação para vê-la aqui."
          >
            <>
              <ActivityLogList entries={entries} />

              <div className="pt-4 flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {entries.length} {entries.length === 1 ? 'registro' : 'registros'} carregados
                </span>
                {hasMore ? (
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…</>
                      : 'Carregar mais'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Fim do histórico</span>
                )}
              </div>
            </>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
