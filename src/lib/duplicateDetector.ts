import { normalizeForComparison } from './descriptionCleaner';
import type { Transaction } from '@/contexts/TransactionsContext';
import type { NormalizedTransactionRow } from './transactionNormalization';

export type DuplicateStatus = 'duplicate' | 'possible' | 'unique';

export interface ImportRow extends NormalizedTransactionRow {
  id: string;
  duplicateStatus: DuplicateStatus;
  duplicateOf?: string; // id of existing transaction
  selected: boolean;
}

/**
 * Check incoming rows against existing transactions for duplicates.
 * - Exact: same date + amount + first 20 chars of normalized description → "duplicate"
 * - Partial: same date + amount but different description → "possible"
 * - Otherwise → "unique"
 */
export function detectDuplicates(
  incoming: NormalizedTransactionRow[],
  existing: Transaction[]
): ImportRow[] {
  // Build lookup index: "date|amount" → array of normalized descriptions
  const index = new Map<string, { normalized: string; id: string }[]>();

  for (const tx of existing) {
    const key = `${tx.transaction_date}|${tx.amount}|${tx.type}`;
    const entry = {
      normalized: normalizeForComparison(tx.description || '').substring(0, 20),
      id: tx.id,
    };
    const arr = index.get(key);
    if (arr) arr.push(entry);
    else index.set(key, [entry]);
  }

  return incoming.map((row, i) => {
    const key = `${row.date}|${row.amount}|${row.type}`;
    const matches = index.get(key);

    let duplicateStatus: DuplicateStatus = 'unique';
    let duplicateOf: string | undefined;

    if (matches && matches.length > 0) {
      const incomingNorm = normalizeForComparison(row.description).substring(0, 20);

      const exactMatch = matches.find(m => m.normalized === incomingNorm);
      if (exactMatch) {
        duplicateStatus = 'duplicate';
        duplicateOf = exactMatch.id;
      } else {
        duplicateStatus = 'possible';
        duplicateOf = matches[0].id;
      }
    }

    return {
      ...row,
      id: `import-${i}-${Date.now()}`,
      duplicateStatus,
      duplicateOf,
      selected: duplicateStatus !== 'duplicate', // auto-deselect exact duplicates
    };
  });
}

export function getDuplicateCounts(rows: ImportRow[]) {
  return {
    total: rows.length,
    unique: rows.filter(r => r.duplicateStatus === 'unique').length,
    possible: rows.filter(r => r.duplicateStatus === 'possible').length,
    duplicate: rows.filter(r => r.duplicateStatus === 'duplicate').length,
  };
}
