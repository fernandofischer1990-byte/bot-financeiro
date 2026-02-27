import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactionsContext, TransactionInput } from '@/contexts/TransactionsContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TransactionPreview, ExtractedTransaction } from './TransactionPreview';
import { NormalizedTransactionRow } from '@/lib/transactionNormalization';
import { parseSpreadsheetFile, parseStatementPDF } from '@/services/fileParsingService';

type UploadStep = 'idle' | 'loading' | 'preview' | 'importing';

export function FileUpload() {
  const [parsedData, setParsedData] = useState<NormalizedTransactionRow[]>([]);
  const [extractedTransactions, setExtractedTransactions] = useState<ExtractedTransaction[]>([]);
  const [summary, setSummary] = useState<{ totalTransactions: number; totalIncome: number; totalExpenses: number } | undefined>();
  const [step, setStep] = useState<UploadStep>('idle');
  const [uploadType, setUploadType] = useState<'spreadsheet' | 'pdf' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addMultipleTransactions } = useTransactionsContext();
  const { toast } = useToast();

  const resetState = () => {
    setParsedData([]);
    setExtractedTransactions([]);
    setSummary(undefined);
    setStep('idle');
    setUploadType(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'pdf') {
      setStep('loading');
      setUploadType('pdf');
      try {
        const result = await parseStatementPDF(file);
        setExtractedTransactions(result.transactions);
        setSummary(result.summary);
        setStep('preview');
        toast({ title: `✅ ${result.transactions.length} transações extraídas!`, description: 'Revise e confirme a importação' });
      } catch (error) {
        toast({ title: 'Erro ao processar PDF', description: error instanceof Error ? error.message : 'Verifique se o arquivo é um extrato bancário válido', variant: 'destructive' });
        resetState();
      }
    } else if (['csv', 'xls', 'xlsx', 'ods', 'tsv'].includes(extension || '')) {
      setStep('loading');
      setUploadType('spreadsheet');
      try {
        const rows = await parseSpreadsheetFile(file);
        setParsedData(rows);
        setStep('preview');
      } catch (error) {
        toast({ title: 'Erro ao ler arquivo', description: 'Verifique se o arquivo está no formato correto', variant: 'destructive' });
        resetState();
      }
    } else {
      toast({ title: 'Formato não suportado', description: 'Use PDF, CSV, XLS, XLSX, ODS ou TSV', variant: 'destructive' });
    }
  };

  const importSpreadsheetData = async () => {
    const validRows = parsedData.filter(r => !r.error && r.amount > 0);
    if (validRows.length === 0) {
      toast({ title: 'Nenhum dado válido para importar', variant: 'destructive' });
      return;
    }

    setStep('importing');
    const inputs: TransactionInput[] = validRows.map(r => ({
      type: r.type, amount: r.amount, category: r.category,
      description: r.description, transaction_date: r.date, source: 'upload',
    }));

    const count = await addMultipleTransactions(inputs);
    if (count > 0) { toast({ title: `✅ ${count} transações importadas!` }); resetState(); }
    else setStep('preview');
  };

  const importPDFData = async () => {
    const selected = extractedTransactions.filter(t => t.selected);
    if (selected.length === 0) {
      toast({ title: 'Nenhuma transação selecionada', variant: 'destructive' });
      return;
    }

    setStep('importing');
    const inputs: TransactionInput[] = selected.map(t => ({
      type: t.type, amount: t.amount, category: t.suggestedCategory,
      description: t.description, transaction_date: t.date, source: 'upload',
    }));

    const count = await addMultipleTransactions(inputs);
    if (count > 0) { toast({ title: `✅ ${count} transações importadas!` }); resetState(); }
    else setStep('preview');
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
        {step === 'idle' && (
          <>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.pdf,.ods,.tsv" onChange={handleFileChange} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste um arquivo</p>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> PDF (Extrato)</span>
                  <span className="flex items-center gap-1"><FileSpreadsheet className="h-3 w-3" /> CSV, XLS, XLSX, ODS, TSV</span>
                </div>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>PDF:</strong> Extratos bancários - extração automática com IA<br />
              <strong>Planilha:</strong> CSV, XLS, XLSX, ODS, TSV com colunas: valor, tipo, categoria, data, descricao
            </p>
          </>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
            <span className="text-sm">{uploadType === 'pdf' ? 'Processando extrato com IA...' : 'Processando arquivo...'}</span>
            {uploadType === 'pdf' && <span className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</span>}
          </div>
        )}

        {step === 'preview' && uploadType === 'spreadsheet' && parsedData.length > 0 && (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-success"><CheckCircle className="h-4 w-4" /> {validCount} válidas</span>
              {errorCount > 0 && <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-4 w-4" /> {errorCount} erros</span>}
            </div>
            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-2 space-y-1 text-xs">
                {parsedData.slice(0, 20).map((row, i) => (
                  <div key={i} className={`p-2 rounded ${row.error ? 'bg-destructive/10' : 'bg-muted'}`}>
                    {row.error ? <span className="text-destructive">{row.error}</span> : <span>{row.type === 'income' ? '↑' : '↓'} R$ {row.amount.toFixed(2)} - {row.category} ({row.date})</span>}
                  </div>
                ))}
                {parsedData.length > 20 && <p className="text-muted-foreground p-2">... e mais {parsedData.length - 20} linhas</p>}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetState} className="flex-1">Cancelar</Button>
              <Button onClick={importSpreadsheetData} disabled={validCount === 0} className="flex-1">Importar {validCount} transações</Button>
            </div>
          </>
        )}

        {step === 'preview' && uploadType === 'pdf' && extractedTransactions.length > 0 && (
          <TransactionPreview transactions={extractedTransactions} onTransactionsChange={setExtractedTransactions} onConfirm={importPDFData} onCancel={resetState} isImporting={false} summary={summary} />
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
            <span className="text-sm">Importando transações...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
