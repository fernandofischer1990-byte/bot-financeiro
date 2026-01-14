// Centralized transaction normalization utilities
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './constants';
import { suggestCategory } from './categoryMapping';
import { normalizeToLocalDate } from './dateUtils';

const VALID_EXPENSE_CATEGORIES: string[] = EXPENSE_CATEGORIES.map(c => c.value);
const VALID_INCOME_CATEGORIES: string[] = INCOME_CATEGORIES.map(c => c.value);
const ALL_VALID_CATEGORIES: string[] = ALL_CATEGORIES.map(c => c.value);

/**
 * Normalize amount from various formats to a number
 * Handles: "50", "50,00", "50.00", "R$ 50,00", negative values, etc.
 */
export function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return isNaN(value) ? null : Math.abs(value);
  }
  
  if (typeof value !== 'string') {
    return null;
  }
  
  // Remove currency symbols, spaces, and common prefixes
  let cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle negative values
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle Brazilian format: 1.234,56 -> 1234.56
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '');
    cleaned = cleaned.replace(',', '.');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : Math.abs(parsed);
}

/**
 * Normalize and validate category based on transaction type
 * Falls back to suggestCategory or default category if invalid
 */
export function normalizeCategory(
  value: unknown,
  type: 'income' | 'expense',
  description?: string
): string {
  const defaultCategory = type === 'expense' ? 'outros_despesa' : 'outros_receita';
  const validCategories = type === 'expense' ? VALID_EXPENSE_CATEGORIES : VALID_INCOME_CATEGORIES;
  
  if (typeof value === 'string' && value.trim()) {
    // Normalize: remove accents, lowercase, trim
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    // Direct match
    if (validCategories.includes(normalized)) {
      return normalized;
    }
    
    // Check original value (in case it's already normalized)
    const original = value.trim().toLowerCase();
    if (validCategories.includes(original)) {
      return original;
    }
    
    // Check if it's a valid category but wrong type
    if (ALL_VALID_CATEGORIES.includes(normalized) || ALL_VALID_CATEGORIES.includes(original)) {
      // Valid category but wrong type - use suggestion
      if (description) {
        return suggestCategory(description, type);
      }
      return defaultCategory;
    }
  }
  
  // Try to suggest based on description
  if (description) {
    return suggestCategory(description, type);
  }
  
  return defaultCategory;
}

/**
 * Infer transaction type from raw data
 * Used for spreadsheet imports where type might be explicit or need inference
 */
export function inferTransactionType(
  typeValue: unknown,
  amount: number
): 'income' | 'expense' {
  if (typeof typeValue === 'string') {
    const normalized = typeValue.toLowerCase().trim();
    
    // Explicit income indicators
    if (
      normalized.includes('receita') ||
      normalized.includes('entrada') ||
      normalized.includes('income') ||
      normalized.includes('credit') ||
      normalized.includes('crédito') ||
      normalized.includes('credito')
    ) {
      return 'income';
    }
    
    // Explicit expense indicators
    if (
      normalized.includes('despesa') ||
      normalized.includes('saída') ||
      normalized.includes('saida') ||
      normalized.includes('expense') ||
      normalized.includes('debit') ||
      normalized.includes('débito') ||
      normalized.includes('debito') ||
      normalized.includes('gasto')
    ) {
      return 'expense';
    }
  }
  
  // If amount is negative, it's likely an expense
  // Note: we always store positive amounts, the type determines direction
  if (typeof amount === 'number' && amount < 0) {
    return 'expense';
  }
  
  // Default to expense (safer assumption for financial tracking)
  return 'expense';
}

/**
 * Normalize a raw transaction row from spreadsheet import
 */
export interface NormalizedTransactionRow {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  error?: string;
}

export function normalizeTransactionRow(
  row: Record<string, unknown>,
  rowIndex: number
): NormalizedTransactionRow {
  try {
    // Extract raw values with various column name possibilities
    const rawAmount = row['valor'] || row['amount'] || row['Valor'] || row['Amount'] || row['value'] || row['Value'] || 0;
    const rawType = row['tipo'] || row['type'] || row['Tipo'] || row['Type'] || '';
    const rawCategory = row['categoria'] || row['category'] || row['Categoria'] || row['Category'] || '';
    const rawDescription = row['descricao'] || row['description'] || row['Descrição'] || row['Description'] || row['desc'] || '';
    const rawDate = row['data'] || row['date'] || row['Data'] || row['Date'] || '';
    
    // Normalize amount
    const amount = normalizeAmount(rawAmount);
    if (amount === null || amount === 0) {
      return {
        type: 'expense',
        amount: 0,
        category: '',
        description: '',
        date: '',
        error: `Linha ${rowIndex + 2}: Valor inválido ou zero`,
      };
    }
    
    // Infer type from explicit column or amount sign
    const originalAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(',', '.'));
    const type = inferTransactionType(rawType, originalAmount);
    
    // Normalize category
    const description = String(rawDescription).trim();
    const category = normalizeCategory(rawCategory, type, description);
    
    // Normalize date
    const date = normalizeToLocalDate(rawDate);
    
    return {
      type,
      amount,
      category,
      description,
      date,
    };
  } catch {
    return {
      type: 'expense',
      amount: 0,
      category: '',
      description: '',
      date: '',
      error: `Linha ${rowIndex + 2}: Erro ao processar`,
    };
  }
}
