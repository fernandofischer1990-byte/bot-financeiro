import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactionsContext, TransactionInput } from '@/contexts/TransactionsContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { read, utils } from 'xlsx';

import { FileDropZone } from './FileDropZone';
import { ColumnMapper, ColumnMapping } from './ColumnMapper';
import { DuplicateReview } from './DuplicateReview';
import { ImportReviewTable } from './ImportReviewTable';
import { ImportSummary } from './ImportSummary';
import { ImportHistory } from './ImportHistory';

import { NormalizedTransactionRow, normalizeTransactionRow, normalizeAmount, normalizeCategory, inferTransactionType } from '@/lib/transactionNormalization';
import { normalizeToLocalDate } from '@/lib/dateUtils';
import { parseOFX } from '@/lib/ofxParser';
import { parseQIF } from '@/lib/qifParser';
import { parseStatementPDF } from '@/services/fileParsingService';
import { detectDuplicates, ImportRow, getDuplicateCounts } from '@/lib/duplicateDetector';
import { cleanDescription } from '@/lib/descriptionCleaner';
import { saveImportHistory } from '@/services/importService';
import { getUserCategoryMappings, findLearnedCategory, saveLearnedMappings, CategoryMapping } from '@/services/categoryMappingService';

type WizardStep = 'upload' | 'mapping' | 'duplicates' | 'review' | 'summary' | 'loading';

// Auto-detect column mapping from source columns
function autoDetectMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = { date: '', amount: '', description: '', type: '', category: '' };
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const col of columns) {
    const n = norm(col);
    if (!mapping.date && ['data', 'date', 'dt'].includes(n)) mapping.date = col;
    else if (!mapping.amount && ['valor', 'amount', 'value', 'montante', 'quantia'].includes(n)) mapping.amount = col;
    else if (!mapping.description && ['descricao', 'description', 'desc', 'historico'].includes(n)) mapping.description = col;
    else if (!mapping.type && ['tipo', 'type'].includes(n)) mapping.type = col;
    else if (!mapping.category && ['categoria', 'category'].includes(n)) mapping.category = col;
  }

  return mapping;
}

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState('');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', amount: '', description: '', type: '', category: '' });
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [userMappings, setUserMappings] = useState<CategoryMapping[]>([]);
  const originalRowsRef = useRef<ImportRow[]>([]);

  const { transactions, addMultipleTransactions } = useTransactionsContext();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      getUserCategoryMappings(user.id).then(setUserMappings);
    }
  }, [user]);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setFileFormat('');
    setRawData([]);
    setSourceColumns([]);
    setMapping({ date: '', amount: '', description: '', type: '', category: '' });
    setImportRows([]);
    setTotalParsed(0);
    setIsImporting(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setFileName(file.name);
    setFileFormat(ext);

    // --- PDF ---
    if (ext === 'pdf') {
      setStep('loading');
      try {
        const result = await parseStatementPDF(file);
        const normalized: NormalizedTransactionRow[] = result.transactions.map(t => {
          const learnedCat = findLearnedCategory(t.description, userMappings);
          return {
            type: t.type,
            amount: t.amount,
            category: learnedCat || t.suggestedCategory,
            description: t.description,
            date: t.date,
            isLearnedCategory: !!learnedCat
          };
        });
        setTotalParsed(normalized.length);
        const withDuplicates = detectDuplicates(normalized as any, transactions);
        originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
        setImportRows(withDuplicates);
        setStep('duplicates');
        toast({ title: `✅ ${normalized.length} transações extraídas do PDF` });
      } catch (error) {
        toast({ title: 'Erro ao processar PDF', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
        reset();
      }
      return;
    }

    // --- OFX ---
    if (ext === 'ofx') {
      setStep('loading');
      try {
        const text = await file.text();
        const normalized = parseOFX(text).map(t => {
          const learnedCat = findLearnedCategory(t.description, userMappings);
          if (learnedCat) {
            t.category = learnedCat;
            (t as any).isLearnedCategory = true;
          }
          return t;
        });
        if (normalized.length === 0) throw new Error('Nenhuma transação encontrada no arquivo OFX');
        setTotalParsed(normalized.length);
        const withDuplicates = detectDuplicates(normalized as any, transactions);
        originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
        setImportRows(withDuplicates);
        setStep('duplicates');
        toast({ title: `✅ ${normalized.length} transações extraídas do OFX` });
      } catch (error) {
        toast({ title: 'Erro ao processar OFX', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
        reset();
      }
      return;
    }

    // --- QIF ---
    if (ext === 'qif') {
      setStep('loading');
      try {
        const text = await file.text();
        const normalized = parseQIF(text).map(t => {
          const learnedCat = findLearnedCategory(t.description, userMappings);
          if (learnedCat) {
            t.category = learnedCat;
            (t as any).isLearnedCategory = true;
          }
          return t;
        });
        if (normalized.length === 0) throw new Error('Nenhuma transação encontrada no arquivo QIF');
        setTotalParsed(normalized.length);
        const withDuplicates = detectDuplicates(normalized as any, transactions);
        originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
        setImportRows(withDuplicates);
        setStep('duplicates');
        toast({ title: `✅ ${normalized.length} transações extraídas do QIF` });
      } catch (error) {
        toast({ title: 'Erro ao processar QIF', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
        reset();
      }
      return;
    }

    // --- Spreadsheet (CSV, XLS, XLSX, ODS, TSV) ---
    if (['csv', 'xls', 'xlsx', 'ods', 'tsv'].includes(ext)) {
      setStep('loading');
      try {
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (data.length === 0) throw new Error('Arquivo vazio ou sem dados reconhecíveis');

        const columns = Object.keys(data[0]);
        setRawData(data);
        setSourceColumns(columns);

        const detected = autoDetectMapping(columns);
        setMapping(detected);

        // If required columns detected, skip mapping
        if (detected.date && detected.amount) {
          processSpreadsheetData(data, detected);
        } else {
          setStep('mapping');
        }
      } catch (error) {
        toast({ title: 'Erro ao ler arquivo', description: error instanceof Error ? error.message : 'Formato inválido', variant: 'destructive' });
        reset();
      }
      return;
    }

    toast({ title: 'Formato não suportado', description: 'Use PDF, CSV, XLS, XLSX, ODS, TSV, OFX ou QIF', variant: 'destructive' });
  }, [transactions, toast, reset]);

  const processSpreadsheetData = useCallback((data: Record<string, unknown>[], map: ColumnMapping) => {
    const normalized: NormalizedTransactionRow[] = data.map((row, i) => {
      try {
        const rawAmount = map.amount ? row[map.amount] : 0;
        const rawDate = map.date ? row[map.date] : '';
        const rawDesc = map.description ? row[map.description] : '';
        const rawType = map.type ? row[map.type] : '';
        const rawCat = map.category ? row[map.category] : '';

        const amount = normalizeAmount(rawAmount);
        if (!amount || amount === 0) {
          return { type: 'expense' as const, amount: 0, category: '', description: '', date: '', error: `Linha ${i + 2}: Valor inválido` };
        }

        const originalAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(',', '.'));
        const type = inferTransactionType(rawType, originalAmount);
        const description = cleanDescription(String(rawDesc || '').trim());
        const category = normalizeCategory(rawCat || undefined, type, description);
        const date = normalizeToLocalDate(rawDate);

        return { type, amount, category, description, date };
      } catch {
        return { type: 'expense' as const, amount: 0, category: '', description: '', date: '', error: `Linha ${i + 2}: Erro` };
      }
    }).filter(r => !r.error && r.amount > 0);

    setTotalParsed(normalized.length);
    const withDuplicates = detectDuplicates(normalized, transactions);
    setImportRows(withDuplicates);
    setStep('duplicates');
  }, [transactions]);

  const handleMappingConfirm = useCallback(() => {
    processSpreadsheetData(rawData, mapping);
  }, [rawData, mapping, processSpreadsheetData]);

  const handleFinalImport = useCallback(async () => {
    const selected = importRows.filter(r => r.selected);
    if (selected.length === 0 || !user) return;

    setIsImporting(true);

    const inputs: TransactionInput[] = selected.map(r => ({
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      transaction_date: r.date,
      source: 'upload',
    }));

    const count = await addMultipleTransactions(inputs);

    if (count > 0) {
      const counts = getDuplicateCounts(importRows);
      await saveImportHistory(user.id, {
        file_name: fileName,
        file_format: fileFormat,
        total_records: totalParsed,
        imported_records: count,
        duplicate_records: counts.duplicate,
        skipped_records: totalParsed - count,
      });

      toast({ title: `✅ ${count} transações importadas com sucesso!` });
      reset();
    } else {
      setIsImporting(false);
    }
  }, [importRows, user, addMultipleTransactions, fileName, fileFormat, totalParsed, toast, reset]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Transações
          </CardTitle>
          {step !== 'upload' && step !== 'loading' && (
            <div className="flex items-center gap-1 mt-2">
              {['upload', 'mapping', 'duplicates', 'review', 'summary'].map((s, i) => {
                const steps = ['upload', 'mapping', 'duplicates', 'review', 'summary'];
                const currentIdx = steps.indexOf(step);
                const isActive = i <= currentIdx;
                const labels = ['Upload', 'Colunas', 'Duplicatas', 'Revisão', 'Confirmar'];
                return (
                  <div key={s} className="flex items-center gap-1">
                    {i > 0 && <div className={`h-px w-4 ${isActive ? 'bg-primary' : 'bg-border'}`} />}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      i === currentIdx ? 'bg-primary text-primary-foreground' :
                      isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {step === 'upload' && (
            <FileDropZone onFileSelected={handleFile} />
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
              <span className="text-sm">Processando arquivo...</span>
              <span className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</span>
            </div>
          )}

          {step === 'mapping' && (
            <ColumnMapper
              sourceColumns={sourceColumns}
              sampleData={rawData}
              mapping={mapping}
              onMappingChange={setMapping}
              onConfirm={handleMappingConfirm}
              onBack={reset}
            />
          )}

          {step === 'duplicates' && (
            <DuplicateReview
              rows={importRows}
              onRowsChange={setImportRows}
              onConfirm={() => setStep('review')}
              onBack={reset}
            />
          )}

          {step === 'review' && (
            <ImportReviewTable
              rows={importRows}
              onRowsChange={setImportRows}
              onConfirm={() => setStep('summary')}
              onBack={() => setStep('duplicates')}
            />
          )}

          {step === 'summary' && (
            <ImportSummary
              rows={importRows}
              fileName={fileName}
              fileFormat={fileFormat}
              totalParsed={totalParsed}
              duplicateCount={getDuplicateCounts(importRows).duplicate}
              isImporting={isImporting}
              onConfirm={handleFinalImport}
              onBack={() => setStep('review')}
            />
          )}
        </CardContent>
      </Card>

      {step === 'upload' && <ImportHistory />}
    </div>
  );
}
