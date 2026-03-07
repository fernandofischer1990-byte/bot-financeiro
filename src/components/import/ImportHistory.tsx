import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fetchImportHistory, ImportHistoryRecord } from '@/services/importService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/constants';

export function ImportHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ImportHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchImportHistory(user.id).then(({ data }) => {
      setRecords(data);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-sm text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhuma importação realizada ainda
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Importações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Arquivo</TableHead>
                <TableHead className="text-xs text-center">Total</TableHead>
                <TableHead className="text-xs text-center">Importadas</TableHead>
                <TableHead className="text-xs text-center">Duplicatas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">
                    {r.file_name}
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">{r.file_format}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-center">{r.total_records}</TableCell>
                  <TableCell className="text-xs text-center text-success">{r.imported_records}</TableCell>
                  <TableCell className="text-xs text-center text-destructive">{r.duplicate_records}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
