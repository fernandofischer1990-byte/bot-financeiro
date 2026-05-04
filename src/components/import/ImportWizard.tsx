import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactionsContext, TransactionInput } from '@/contexts/TransactionsContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { fetchMappingTemplates, saveMappingTemplate, deleteMappingTemplate, MappingTemplate } from '@/services/mappingTemplateService';
import { categorizeWithAI } from '@/services/categorizationService';

type WizardStep = 'upload' | 'mapping' | 'duplicates' | 'review' | 'summary' | 'loading';

interface DetectionResult {
  mapping: ColumnMapping;
  confidence: number;
  detectedStructure: 'split' | 'single' | 'unknown';
  warnings: string[];
}

// Auto-detect column mapping from source columns
const BALANCE_ALIASES = ['total', 'saldo', 'balance', 'running balance'];

const DATE_ALIASES = ['data', 'date', 'dt', 'transaction date', 'data transacao', 'data da transacao', 'posted date'];
const INCOME_ALIASES = ['receita', 'receitas', 'credit', 'income', 'entrada', 'credito', 'deposito', 'valor recebido'];
const EXPENSE_ALIASES = ['despesa', 'despesas', 'debit', 'expense', 'saida', 'debito', 'valor pago'];
const AMOUNT_ALIASES = ['valor', 'amount', 'value', 'montante', 'quantia'];
const DESC_ALIASES = ['descricao', 'description', 'desc', 'historico', 'detalhes', 'memo', 'lancamento', 'lancamentos'];
const TYPE_ALIASES = ['tipo', 'type'];
const CATEGORY_ALIASES = ['categoria', 'category'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const match = (aliases: string[], value: string) => aliases.some(a => norm(a) === value);

function autoDetectWithConfidence(columns: string[]): DetectionResult {
  const mapping: ColumnMapping = { date: '', amount: '', description: '', type: '', category: '', income: '', expense: '' };
  const warnings: string[] = [];
  const ignoredBalanceCols: string[] = [];

  for (const col of columns) {
    const n = norm(col);
    if (match(BALANCE_ALIASES, n)) {
      ignoredBalanceCols.push(col);
      continue;
    }

    if (!mapping.date && match(DATE_ALIASES, n)) mapping.date = col;
    else if (!mapping.income && match(INCOME_ALIASES, n)) mapping.income = col;
    else if (!mapping.expense && match(EXPENSE_ALIASES, n)) mapping.expense = col;
    else if (!mapping.amount && match(AMOUNT_ALIASES, n)) mapping.amount = col;
    else if (!mapping.description && match(DESC_ALIASES, n)) mapping.description = col;
    else if (!mapping.type && match(TYPE_ALIASES, n)) mapping.type = col;
    else if (!mapping.category && match(CATEGORY_ALIASES, n)) mapping.category = col;
  }

  if (ignoredBalanceCols.length > 0) {
    warnings.push(`Coluna "${ignoredBalanceCols.join(', ')}" detectada como saldo e ignorada`);
  }

  // If both income and expense detected, clear amount to use split mode
  if (mapping.income && mapping.expense) {
    mapping.amount = '';
  }

  // Calculate confidence
  let confidence = 0;
  const hasDate = mapping.date !== '';
  const hasAmount = mapping.amount !== '';
  const hasSplit = mapping.income !== '' || mapping.expense !== '';

  if (hasDate) confidence += 50;
  if (hasAmount || hasSplit) confidence += 40;
  if (mapping.description) confidence += 10;

  let detectedStructure: 'split' | 'single' | 'unknown' = 'unknown';
  if (hasSplit) detectedStructure = 'split';
  else if (hasAmount) detectedStructure = 'single';

  return { mapping, confidence, detectedStructure, warnings };
}

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState('');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', amount: '', description: '', type: '', category: '', income: '', expense: '' });
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [userMappings, setUserMappings] = useState<CategoryMapping[]>([]);
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [detectionInfo, setDetectionInfo] = useState<DetectionResult | null>(null);
  const [isFallbackMapping, setIsFallbackMapping] = useState(false);
  const [aiProgress, setAiProgress] = useState<string>('');
  const originalRowsRef = useRef<ImportRow[]>([]);

  const { transactions, addMultipleTransactions } = useTransactionsContext();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      getUserCategoryMappings(user.id).then(setUserMappings);
      fetchMappingTemplates(user.id).then(setTemplates);
    }
  }, [user]);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setFileFormat('');
    setRawData([]);
    setSourceColumns([]);
    setMapping({ date: '', amount: '', description: '', type: '', category: '', income: '', expense: '' });
    setImportRows([]);
    setTotalParsed(0);
    setIsImporting(false);
    setDetectionInfo(null);
    setIsFallbackMapping(false);
    setAiProgress('');
  }, []);

  /**
   * Apply AI categorization to all rows that don't have a learned mapping.
   * Mutates a copy and returns the updated array.
   */
  const applyAICategorization = useCallback(async (
    rows: NormalizedTransactionRow[]
  ): Promise<NormalizedTransactionRow[]> => {
    // Only send rows that don't already come from a learned mapping
    const itemsToClassify = rows
      .map((r, index) => ({ index, description: r.description || '', type: r.type, isLearned: (r as any).isLearnedCategory === true }))
      .filter((it) => !it.isLearned && it.description.trim().length > 0)
      .map(({ index, description, type }) => ({ index, description, type }));

    if (itemsToClassify.length === 0) return rows;

    setAiProgress(`Classificando ${itemsToClassify.length} transações com IA...`);
    const { map, error } = await categorizeWithAI(itemsToClassify);

    if (error) {
      toast({
        title: 'Categorização por IA falhou',
        description: `${error} — usando categorias por padrão.`,
        variant: 'destructive',
      });
      return rows;
    }

    return rows.map((r, index) => {
      const aiCat = map.get(index);
      if (aiCat) {
        return { ...r, category: aiCat, isAiCategorized: true } as NormalizedTransactionRow;
      }
      return r;
    });
  }, [toast]);

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
        const aiClassified = await applyAICategorization(normalized);
        const withDuplicates = detectDuplicates(aiClassified as any, transactions);
        originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
        setImportRows(withDuplicates);
        setAiProgress('');
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
        const aiClassified = await applyAICategorization(normalized as any);
        const withDuplicates = detectDuplicates(aiClassified as any, transactions);
        originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
        setImportRows(withDuplicates);
        setAiProgress('');
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
        const aiClassified = await applyAICategorization(normalized as any);
        const withDuplicates = detectDuplicates(aiClassified as any, transactions);
        originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
        setImportRows(withDuplicates);
        setAiProgress('');
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

        const columns = [...new Set(data.flatMap(row => Object.keys(row)))];
        setRawData(data);
        setSourceColumns(columns);

        const detection = autoDetectWithConfidence(columns);
        setMapping(detection.mapping);
        setDetectionInfo(detection);

        if (detection.confidence >= 70) {
          processSpreadsheetData(data, detection.mapping);
        } else {
          setIsFallbackMapping(true);
          setStep('mapping');
        }
      } catch (error) {
        toast({ title: 'Erro ao ler arquivo', description: error instanceof Error ? error.message : 'Formato inválido', variant: 'destructive' });
        reset();
      }
      return;
    }

    toast({ title: 'Formato não suportado', description: 'Use PDF, CSV, XLS, XLSX, ODS, TSV, OFX ou QIF', variant: 'destructive' });
  }, [transactions, toast, reset, userMappings]);

  const getRowValue = (row: Record<string, unknown>, key: string): unknown => {
    if (key in row) return row[key];
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === lowerKey) return row[k];
    }
    return undefined;
  };

  const processSpreadsheetData = useCallback(async (data: Record<string, unknown>[], map: ColumnMapping) => {
    const useSplitMode = map.income !== '' || map.expense !== '';

    const normalized: NormalizedTransactionRow[] = data.map((row, i) => {
      try {
        const rawDate = map.date ? getRowValue(row, map.date) : '';
        const rawDesc = map.description ? getRowValue(row, map.description) : '';
        const rawCat = map.category ? getRowValue(row, map.category) : '';

        let amount: number;
        let type: 'income' | 'expense';

        if (useSplitMode) {
          const rawIncomeVal = map.income ? getRowValue(row, map.income) : undefined;
          const rawExpenseVal = map.expense ? getRowValue(row, map.expense) : undefined;
          const rawIncome = rawIncomeVal !== undefined ? normalizeAmount(rawIncomeVal) : 0;
          const rawExpense = rawExpenseVal !== undefined ? normalizeAmount(rawExpenseVal) : 0;

          if (rawIncome !== null && rawIncome > 0) {
            type = 'income';
            amount = rawIncome;
          } else if (rawExpense !== null && rawExpense > 0) {
            type = 'expense';
            amount = rawExpense;
          } else {
            console.warn(`Row ${i + 2}: income=${rawIncomeVal}, expense=${rawExpenseVal}, parsed: income=${rawIncome}, expense=${rawExpense}`);
            return { type: 'expense' as const, amount: 0, category: '', description: '', date: '', error: `Linha ${i + 2}: Sem valor` };
          }
        } else {
          const rawAmount = map.amount ? getRowValue(row, map.amount) : 0;
          amount = normalizeAmount(rawAmount);
          if (!amount || amount === 0) {
            return { type: 'expense' as const, amount: 0, category: '', description: '', date: '', error: `Linha ${i + 2}: Valor inválido` };
          }
          const rawType = map.type ? row[map.type] : '';
          const originalAmount = typeof rawAmount === 'number' 
            ? rawAmount 
            : (() => {
                let s = String(rawAmount).replace(/R\$\s*/gi, '').trim();
                const neg = s.startsWith('-');
                if (neg) s = s.substring(1);
                s = s.replace(/\s/g, '');
                if (s.includes(',') && s.includes('.')) {
                  if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
                    s = s.replace(/,/g, '');
                  } else {
                    s = s.replace(/\./g, '').replace(',', '.');
                  }
                } else if (s.includes(',')) { s = s.replace(',', '.'); }
                const v = parseFloat(s);
                return isNaN(v) ? 0 : (neg ? -v : v);
              })();
          type = inferTransactionType(rawType, originalAmount);
        }

        const description = cleanDescription(String(rawDesc || '').trim());
        const learnedCat = findLearnedCategory(description, userMappings);
        const category = learnedCat || normalizeCategory(rawCat || undefined, type, description);
        const date = normalizeToLocalDate(rawDate);

        return { type, amount, category, description, date, isLearnedCategory: !!learnedCat };
      } catch {
        return { type: 'expense' as const, amount: 0, category: '', description: '', date: '', error: `Linha ${i + 2}: Erro` };
      }
    }).filter(r => !r.error && r.amount > 0);

    setTotalParsed(normalized.length);
    const withDuplicates = detectDuplicates(normalized as any, transactions);
    originalRowsRef.current = JSON.parse(JSON.stringify(withDuplicates));
    setImportRows(withDuplicates);
    setStep('duplicates');
  }, [transactions, userMappings]);

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

      // Save learned mappings
      await saveLearnedMappings(user.id, originalRowsRef.current, importRows);
      // Refresh mappings
      getUserCategoryMappings(user.id).then(setUserMappings);

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
          {step !== 'upload' && step !== 'loading' && (() => {
            const activeSteps = isFallbackMapping
              ? ['upload', 'mapping', 'duplicates', 'review', 'summary']
              : ['upload', 'duplicates', 'review', 'summary'];
            const activeLabels = isFallbackMapping
              ? ['Upload', 'Colunas', 'Duplicatas', 'Revisão', 'Confirmar']
              : ['Upload', 'Duplicatas', 'Revisão', 'Confirmar'];
            const currentIdx = activeSteps.indexOf(step);
            return (
              <div className="flex items-center gap-1 mt-2">
                {activeSteps.map((s, i) => {
                  const isActive = i <= currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      {i > 0 && <div className={`h-px w-4 ${isActive ? 'bg-primary' : 'bg-border'}`} />}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        i === currentIdx ? 'bg-primary text-primary-foreground' :
                        isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {activeLabels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
            <div className="space-y-4">
              {isFallbackMapping && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Não foi possível detectar a estrutura do arquivo automaticamente. Mapeie as colunas manualmente.
                  </AlertDescription>
                </Alert>
              )}
              <ColumnMapper
                sourceColumns={sourceColumns}
                sampleData={rawData}
                mapping={mapping}
                onMappingChange={setMapping}
                onConfirm={handleMappingConfirm}
                onBack={reset}
                templates={templates}
                onSaveTemplate={async (name) => {
                  if (!user) return;
                  const ok = await saveMappingTemplate(user.id, name, mapping);
                  if (ok) {
                    toast({ title: `Template "${name}" salvo!` });
                    fetchMappingTemplates(user.id).then(setTemplates);
                  }
                }}
                onDeleteTemplate={async (id) => {
                  const ok = await deleteMappingTemplate(id);
                  if (ok && user) {
                    toast({ title: 'Template removido' });
                    fetchMappingTemplates(user.id).then(setTemplates);
                  }
                }}
                onLoadTemplate={(t) => {
                  setMapping(t.mapping);
                  toast({ title: `Template "${t.name}" carregado` });
                }}
              />
            </div>
          )}

          {step === 'duplicates' && (
            <div className="space-y-3">
              {detectionInfo && (
                <Alert className="border-primary/20 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    {detectionInfo.detectedStructure === 'split'
                      ? 'Colunas de Receita e Despesa detectadas — classificação automática aplicada.'
                      : detectionInfo.detectedStructure === 'single'
                        ? 'Coluna de valor único detectada — tipo inferido pelo sinal (+/-).'
                        : 'Estrutura do arquivo detectada automaticamente.'}
                    {detectionInfo.warnings.length > 0 && (
                      <span className="block mt-1 text-xs text-muted-foreground">
                        {detectionInfo.warnings.join(' • ')}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <DuplicateReview
                rows={importRows}
                onRowsChange={setImportRows}
                onConfirm={() => setStep('review')}
                onBack={reset}
              />
            </div>
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
