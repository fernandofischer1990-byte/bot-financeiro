import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactions, TransactionInput } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { read, utils } from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParsedRow {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  error?: string;
}

export function FileUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addMultipleTransactions } = useTransactions();
  const { toast } = useToast();

  const parseFile = async (file: File) => {
    setLoading(true);
    setParsedData([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = utils.sheet_to_json<Record<string, unknown>>(sheet);

      const rows: ParsedRow[] = data.map((row, index) => {
        try {
          // Try to detect columns
          const amount = parseFloat(String(row['valor'] || row['amount'] || row['Valor'] || 0).replace(',', '.'));
          const type = (String(row['tipo'] || row['type'] || row['Tipo'] || '').toLowerCase().includes('receita') || amount > 0) 
            ? 'income' : 'expense';
          const category = String(row['categoria'] || row['category'] || row['Categoria'] || 'outros_despesa');
          const description = String(row['descricao'] || row['description'] || row['Descrição'] || '');
          const dateRaw = row['data'] || row['date'] || row['Data'];
          
          let date = new Date().toISOString().split('T')[0];
          if (dateRaw) {
            const d = new Date(dateRaw as string);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            }
          }

          if (isNaN(amount) || amount === 0) {
            return { type, amount: 0, category, description, date, error: `Linha ${index + 2}: Valor inválido` };
          }

          return { type, amount: Math.abs(amount), category, description, date };
        } catch {
          return { type: 'expense', amount: 0, category: '', description: '', date: '', error: `Linha ${index + 2}: Erro ao processar` };
        }
      });

      setParsedData(rows);
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: 'Erro ao ler arquivo',
        description: 'Verifique se o arquivo está no formato correto (CSV, XLS, XLSX)',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const importData = async () => {
    const validRows = parsedData.filter(r => !r.error && r.amount > 0);
    if (validRows.length === 0) {
      toast({ title: 'Nenhum dado válido para importar', variant: 'destructive' });
      return;
    }

    setImporting(true);
    const inputs: TransactionInput[] = validRows.map(r => ({
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      transaction_date: r.date,
      source: 'upload',
    }));

    const count = await addMultipleTransactions(inputs);
    setImporting(false);

    if (count > 0) {
      toast({ title: `✅ ${count} transações importadas!` });
      setParsedData([]);
      if (fileRef.current) fileRef.current.value = '';
      onSuccess?.();
    }
  };

  const validCount = parsedData.filter(r => !r.error && r.amount > 0).length;
  const errorCount = parsedData.filter(r => r.error).length;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Arquivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Clique para selecionar ou arraste um arquivo
            </p>
            <p className="text-xs text-muted-foreground mt-1">CSV, XLS ou XLSX</p>
          </label>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Processando arquivo...</span>
          </div>
        )}

        {parsedData.length > 0 && (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="h-4 w-4" /> {validCount} válidas
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" /> {errorCount} erros
                </span>
              )}
            </div>

            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-2 space-y-1 text-xs">
                {parsedData.slice(0, 20).map((row, i) => (
                  <div key={i} className={`p-2 rounded ${row.error ? 'bg-destructive/10' : 'bg-muted'}`}>
                    {row.error ? (
                      <span className="text-destructive">{row.error}</span>
                    ) : (
                      <span>
                        {row.type === 'income' ? '↑' : '↓'} R$ {row.amount.toFixed(2)} - {row.category} ({row.date})
                      </span>
                    )}
                  </div>
                ))}
                {parsedData.length > 20 && (
                  <p className="text-muted-foreground p-2">... e mais {parsedData.length - 20} linhas</p>
                )}
              </div>
            </ScrollArea>

            <Button onClick={importData} disabled={importing || validCount === 0} className="w-full">
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Importar {validCount} transações
            </Button>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Colunas esperadas: valor, tipo (receita/despesa), categoria, data, descricao
        </p>
      </CardContent>
    </Card>
  );
}
