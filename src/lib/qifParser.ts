import { NormalizedTransactionRow } from './transactionNormalization';
import { normalizeCategory, normalizeAmount } from './transactionNormalization';
import { normalizeToLocalDate } from './dateUtils';
import { cleanDescription } from './descriptionCleaner';

/**
 * Parse QIF (Quicken Interchange Format) file content.
 * Each transaction starts after a ^ delimiter. Fields start with:
 * D = date, T = amount, P = payee, M = memo, L = category, N = check number
 */
export function parseQIF(content: string): NormalizedTransactionRow[] {
  const transactions: NormalizedTransactionRow[] = [];
  const blocks = content.split('^').filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Skip header lines (start with !)
    if (lines.length === 0 || (lines.length === 1 && lines[0].startsWith('!'))) continue;

    let dateRaw = '';
    let amountRaw = '';
    let payee = '';
    let memo = '';
    let categoryRaw = '';

    for (const line of lines) {
      if (line.startsWith('!')) continue;
      const code = line[0];
      const value = line.substring(1).trim();

      switch (code) {
        case 'D': dateRaw = value; break;
        case 'T': amountRaw = value; break;
        case 'P': payee = value; break;
        case 'M': memo = value; break;
        case 'L': categoryRaw = value; break;
      }
    }

    const amount = normalizeAmount(amountRaw);
    if (!amount || amount === 0) continue;

    const rawAmount = parseFloat(amountRaw.replace(',', '.')) || 0;
    const type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense';

    const rawDescription = payee || memo || '';
    const description = cleanDescription(rawDescription);
    const date = normalizeToLocalDate(dateRaw);
    const category = normalizeCategory(categoryRaw || undefined, type, description);

    transactions.push({ type, amount, category, description, date });
  }

  return transactions;
}
