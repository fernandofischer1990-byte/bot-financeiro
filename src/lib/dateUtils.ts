// Date utilities for consistent local timezone handling

/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone
 * Avoids UTC issues where toISOString() can return wrong day
 */
export function getLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string as a LOCAL date (midnight local time)
 * Avoids timezone issues where new Date('2025-01-14') is interpreted as UTC
 */
export function parseDateOnly(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date();
  }
  
  // YYYY-MM-DD format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Fallback to Date parsing (may have timezone issues)
  return new Date(dateStr);
}

/**
 * Get start and end of day for a date (local timezone)
 */
export function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Normalize date from various formats to YYYY-MM-DD (local timezone)
 * Handles: "2025-01-11", "11/01/2025", "11-01-2025", etc.
 */
const PT_MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

function tryParsePortugueseDate(input: string): string | null {
  // Normalize: lowercase, remove accents
  const norm = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Strip weekday prefix (e.g. "terca-feira, ")
  const afterComma = norm.includes(',') ? norm.substring(norm.indexOf(',') + 1).trim() : norm;

  // Pattern 1: "monthName day, year" e.g. "fevereiro 17, 2026"
  const m1 = afterComma.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (m1) {
    const mo = PT_MONTHS[m1[1]];
    if (mo) return `${m1[3]}-${mo}-${m1[2].padStart(2, '0')}`;
  }

  // Pattern 2: "day de monthName de year" e.g. "17 de fevereiro de 2026"
  const m2 = afterComma.match(/^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})$/);
  if (m2) {
    const mo = PT_MONTHS[m2[2]];
    if (mo) return `${m2[3]}-${mo}-${m2[1].padStart(2, '0')}`;
  }

  return null;
}

export function normalizeToLocalDate(value: unknown): string {
  const today = getLocalISODate();
  
  if (!value || typeof value !== 'string') {
    return today;
  }
  
  const trimmed = value.trim();
  
  // Already in ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Brazilian format DD/MM/YYYY or DD-MM-YYYY
  const brMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const d = day.padStart(2, '0');
    const m = month.padStart(2, '0');
    return `${year}-${m}-${d}`;
  }
  
  // Portuguese long-form dates (e.g. "terça-feira, fevereiro 17, 2026")
  const ptResult = tryParsePortugueseDate(trimmed);
  if (ptResult) return ptResult;
  
  // Try parsing with Date (but use local extraction)
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return getLocalISODate(parsed);
  }
  
  return today;
}
