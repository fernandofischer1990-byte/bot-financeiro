/**
 * Clean bank transaction descriptions for readability.
 * Removes trailing codes, common prefixes, and normalizes casing.
 */

const PREFIXES_TO_REMOVE = [
  /^COMPRA\s+CARTAO\s*/i,
  /^PGTO\s*/i,
  /^PAG\*\s*/i,
  /^PAGTO\s*/i,
  /^PAGAMENTO\s*/i,
  /^DEB\s+AUTOMATICO\s*/i,
  /^DEBITO\s+AUTOMATICO\s*/i,
  /^COMPRA\s*/i,
];

const SUFFIXES_TO_REMOVE = [
  /\s*\*[A-Z0-9]{2,10}$/i,        // *AB123
  /\s+\d{4,}$/,                     // trailing long numbers
  /\s+-\s+\d{2}\/\d{2}$/,          // - 12/34
  /\s+PAR\s+\d+$/i,                // PAR 12345
  /\s+INST\s+\d+\/\d+$/i,          // INST 1/12
];

const KNOWN_MERCHANTS: Record<string, string> = {
  'MERCADO PAO DE ACUCAR': 'Pão de Açúcar',
  'PÃO DE AÇÚCAR': 'Pão de Açúcar',
  'AMAZON': 'Amazon',
  'AMAZON.COM': 'Amazon',
  'UBER ': 'Uber',
  'UBER TRIP': 'Uber',
  'IFOOD': 'iFood',
  'RAPPI': 'Rappi',
  'NETFLIX': 'Netflix',
  'SPOTIFY': 'Spotify',
  'MERCADOLIVRE': 'Mercado Livre',
  'MERCADO LIVRE': 'Mercado Livre',
  'STARBUCKS': 'Starbucks',
  'MCDONALDS': "McDonald's",
  'BURGER KING': 'Burger King',
  'CARREFOUR': 'Carrefour',
  'SMART FIT': 'Smart Fit',
};

export function cleanDescription(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let cleaned = raw.trim();

  // Remove common prefixes
  for (const prefix of PREFIXES_TO_REMOVE) {
    cleaned = cleaned.replace(prefix, '');
  }

  // Remove trailing codes/suffixes
  for (const suffix of SUFFIXES_TO_REMOVE) {
    cleaned = cleaned.replace(suffix, '');
  }

  cleaned = cleaned.trim();

  // Try to match a known merchant
  const upper = cleaned.toUpperCase();
  for (const [pattern, name] of Object.entries(KNOWN_MERCHANTS)) {
    if (upper.includes(pattern)) {
      return name;
    }
  }

  // Title case if all uppercase
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }

  return cleaned || raw.trim();
}

/**
 * Normalize description for duplicate comparison purposes.
 * Strips everything to lowercase alphanumeric.
 */
export function normalizeForComparison(description: string): string {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
