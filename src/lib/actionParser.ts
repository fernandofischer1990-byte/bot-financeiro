// Robust parsing for AI action responses with normalization
import { z } from 'zod';
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './constants';
import { suggestCategory } from './categoryMapping';
import { getLocalISODate } from './dateUtils';

// Valid category values for validation
const VALID_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.map(c => c.value) as string[];
const VALID_INCOME_CATEGORIES = INCOME_CATEGORIES.map(c => c.value) as string[];
const ALL_VALID_CATEGORIES = ALL_CATEGORIES.map(c => c.value) as string[];

// Flexible schema that accepts both number and string for amount
const RawActionSchema = z.object({
  action: z.enum(['add_transaction', 'delete_transaction']),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  id: z.string().optional(),
});

export interface ParsedAction {
  action: 'add_transaction' | 'delete_transaction';
  type?: 'income' | 'expense';
  amount?: number;
  category?: string;
  description?: string;
  date?: string;
  id?: string;
}

export interface ParseResult {
  success: boolean;
  action?: ParsedAction;
  error?: string;
}

/**
 * Normalize amount from various formats to a number
 * Handles: "50", "50,00", "50.00", "R$ 50,00", "R$50", etc.
 */
function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return isNaN(value) || value <= 0 ? null : value;
  }
  
  if (typeof value !== 'string') {
    return null;
  }
  
  // Remove currency symbols, spaces, and common prefixes
  let cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle Brazilian format: 1.234,56 -> 1234.56
  // If there's a comma, treat it as decimal separator
  if (cleaned.includes(',')) {
    // Remove thousand separators (dots before comma)
    cleaned = cleaned.replace(/\./g, '');
    // Replace comma with dot for decimal
    cleaned = cleaned.replace(',', '.');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * Normalize date from various formats to YYYY-MM-DD
 * Handles: "2025-01-11", "11/01/2025", "11-01-2025", etc.
 */
function normalizeDate(value: unknown): string {
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
  
  // Try parsing with Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return today;
}

/**
 * Normalize and validate category based on transaction type
 * Falls back to suggestCategory or default category if invalid
 */
function normalizeCategory(
  value: unknown,
  type: 'income' | 'expense',
  description?: string
): string {
  const defaultCategory = type === 'expense' ? 'outros_despesa' : 'outros_receita';
  const validCategories = type === 'expense' ? VALID_EXPENSE_CATEGORIES : VALID_INCOME_CATEGORIES;
  
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim().toLowerCase();
    
    // Direct match
    if (validCategories.includes(normalized)) {
      return normalized;
    }
    
    // Check if it's in any valid category (might be wrong type)
    if (ALL_VALID_CATEGORIES.includes(normalized)) {
      // It's a valid category but wrong type, use suggestion instead
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
 * Parse and validate AI action response with robust normalization
 */
export function parseAction(jsonString: string): ParseResult {
  try {
    const rawParsed = JSON.parse(jsonString);
    
    // Security: Reject prototype pollution attempts
    if ('__proto__' in rawParsed || 'constructor' in rawParsed || 'prototype' in rawParsed) {
      return { success: false, error: 'Propriedades perigosas detectadas' };
    }
    
    // Validate basic structure
    const validation = RawActionSchema.safeParse(rawParsed);
    if (!validation.success) {
      return { 
        success: false, 
        error: `Formato inválido: ${validation.error.message}` 
      };
    }
    
    const raw = validation.data;
    
    // For delete_transaction, we just need the action and id
    if (raw.action === 'delete_transaction') {
      if (!raw.id) {
        return { success: false, error: 'ID da transação não fornecido' };
      }
      return {
        success: true,
        action: {
          action: 'delete_transaction',
          id: raw.id,
        },
      };
    }
    
    // For add_transaction, validate and normalize all fields
    if (raw.action === 'add_transaction') {
      if (!raw.type) {
        return { success: false, error: 'Tipo da transação não fornecido' };
      }
      
      const amount = normalizeAmount(raw.amount);
      if (amount === null) {
        return { success: false, error: 'Valor inválido ou não fornecido' };
      }
      
      const description = raw.description?.trim() || '';
      const category = normalizeCategory(raw.category, raw.type, description);
      const date = normalizeDate(raw.date);
      
      return {
        success: true,
        action: {
          action: 'add_transaction',
          type: raw.type,
          amount,
          category,
          description,
          date,
        },
      };
    }
    
    return { success: false, error: 'Ação desconhecida' };
  } catch (e) {
    return { 
      success: false, 
      error: e instanceof Error ? e.message : 'Erro ao processar ação' 
    };
  }
}

/**
 * Extract action from AI response content
 * Looks for <!--ACTION:{...}--> format and fallback JSON format
 */
export function extractAction(content: string): ParseResult {
  // Primary format: <!--ACTION:{...}-->
  const actionMatch = content.match(/<!--ACTION:([\s\S]*?)-->/);
  if (actionMatch) {
    return parseAction(actionMatch[1]);
  }
  
  // Fallback: raw JSON with "action" property
  const jsonMatch = content.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (jsonMatch) {
    return parseAction(jsonMatch[0]);
  }
  
  return { success: false, error: 'Nenhuma ação encontrada' };
}
