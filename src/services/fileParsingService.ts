import { read, utils } from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { normalizeTransactionRow, NormalizedTransactionRow, normalizeCategory } from '@/lib/transactionNormalization';
import { normalizeToLocalDate } from '@/lib/dateUtils';
import { ExtractedTransaction } from '@/components/transactions/TransactionPreview';

/**
 * Parse a spreadsheet file (CSV, XLS, XLSX, ODS, TSV) into normalized transaction rows.
 */
export async function parseSpreadsheetFile(file: File): Promise<NormalizedTransactionRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = utils.sheet_to_json<Record<string, unknown>>(sheet);

  return data.map((row, index) => normalizeTransactionRow(row, index));
}

/**
 * Parse a PDF bank statement via the parse-statement edge function.
 * Returns extracted transactions and optional summary.
 */
export async function parseStatementPDF(file: File): Promise<{
  transactions: ExtractedTransaction[];
  summary?: { totalTransactions: number; totalIncome: number; totalExpenses: number };
}> {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const { data, error } = await supabase.functions.invoke('parse-statement', {
    body: { pdfBase64: base64 },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao processar PDF');
  }

  if (!data?.transactions || !Array.isArray(data.transactions)) {
    throw new Error('Nenhuma transação encontrada no extrato');
  }

  const transactions: ExtractedTransaction[] = data.transactions
    .map((t: Record<string, unknown>, index: number) => {
      const type = t.type === 'income' ? 'income' : 'expense';
      const description = String(t.description || '');
      const category = normalizeCategory(t.suggestedCategory, type, description);

      return {
        id: `tx-${index}-${Date.now()}`,
        date: normalizeToLocalDate(t.date),
        type,
        amount: Math.abs(Number(t.amount) || 0),
        description,
        suggestedCategory: category,
        selected: true,
      } as ExtractedTransaction;
    })
    .filter((t: ExtractedTransaction) => t.amount > 0);

  if (transactions.length === 0) {
    throw new Error('Nenhuma transação válida encontrada');
  }

  const summary = data.summary || {
    totalTransactions: transactions.length,
    totalIncome: transactions.filter((t: ExtractedTransaction) => t.type === 'income').reduce((s: number, t: ExtractedTransaction) => s + t.amount, 0),
    totalExpenses: transactions.filter((t: ExtractedTransaction) => t.type === 'expense').reduce((s: number, t: ExtractedTransaction) => s + t.amount, 0),
  };

  return { transactions, summary };
}
