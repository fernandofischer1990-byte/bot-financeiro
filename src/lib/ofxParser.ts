import { NormalizedTransactionRow } from './transactionNormalization';
import { normalizeCategory } from './transactionNormalization';
import { normalizeToLocalDate } from './dateUtils';
import { cleanDescription } from './descriptionCleaner';

/**
 * Parse OFX (Open Financial Exchange) file content into normalized transaction rows.
 * Extracts transactions from <STMTTRN> blocks using regex.
 */
export function parseOFX(content: string): NormalizedTransactionRow[] {
  const transactions: NormalizedTransactionRow[] = [];

  // Match all STMTTRN blocks
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = txRegex.exec(content)) !== null) {
    const block = match[1];

    const trntype = extractTag(block, 'TRNTYPE');
    const dtposted = extractTag(block, 'DTPOSTED');
    const trnamt = extractTag(block, 'TRNAMT');
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');

    const amountRaw = parseFloat(trnamt?.replace(',', '.') || '0');
    const amount = Math.abs(amountRaw);

    if (amount === 0) continue;

    const type: 'income' | 'expense' =
      trntype?.toUpperCase() === 'CREDIT' || amountRaw > 0 ? 'income' : 'expense';

    const rawDescription = name || memo || '';
    const description = cleanDescription(rawDescription);
    const category = normalizeCategory(undefined, type, description);

    // OFX date format: YYYYMMDD or YYYYMMDDHHMMSS
    let date = '';
    if (dtposted && dtposted.length >= 8) {
      const y = dtposted.substring(0, 4);
      const m = dtposted.substring(4, 6);
      const d = dtposted.substring(6, 8);
      date = `${y}-${m}-${d}`;
    } else {
      date = normalizeToLocalDate(dtposted);
    }

    transactions.push({ type, amount, category, description, date });
  }

  return transactions;
}

function extractTag(block: string, tag: string): string {
  // OFX can be SGML-style (<TAG>value) or XML-style (<TAG>value</TAG>)
  const xmlRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const xmlMatch = xmlRegex.exec(block);
  if (xmlMatch) return xmlMatch[1].trim();

  const sgmlRegex = new RegExp(`<${tag}>(.+)`, 'i');
  const sgmlMatch = sgmlRegex.exec(block);
  if (sgmlMatch) return sgmlMatch[1].trim();

  return '';
}
