// Robust parsing for AI action responses with normalization
import { z } from 'zod';
import { normalizeAmount, normalizeCategory } from './transactionNormalization';
import { normalizeToLocalDate } from './dateUtils';

// Flexible schema that accepts both number and string for amount
const RawActionSchema = z.object({
  action: z.enum(['add_transaction', 'delete_transaction', 'delete_all_transactions']),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  id: z.string().optional(),
  filter: z.enum(['all', 'income', 'expense']).optional(),
});

export interface ParsedAction {
  action: 'add_transaction' | 'delete_transaction' | 'delete_all_transactions';
  type?: 'income' | 'expense';
  amount?: number;
  category?: string;
  description?: string;
  date?: string;
  id?: string;
  filter?: 'all' | 'income' | 'expense';
}

export interface ParseResult {
  success: boolean;
  action?: ParsedAction;
  error?: string;
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
    
    // For delete_all_transactions, validate filter
    if (raw.action === 'delete_all_transactions') {
      return {
        success: true,
        action: {
          action: 'delete_all_transactions',
          filter: raw.filter || 'all',
        },
      };
    }
    
    // For add_transaction, validate and normalize all fields
    if (raw.action === 'add_transaction') {
      if (!raw.type) {
        return { success: false, error: 'Tipo da transação não fornecido' };
      }
      
      const amount = normalizeAmount(raw.amount);
      if (amount === null || amount <= 0) {
        return { success: false, error: 'Valor inválido ou não fornecido' };
      }
      
      const description = raw.description?.trim() || '';
      const category = normalizeCategory(raw.category, raw.type, description);
      const date = normalizeToLocalDate(raw.date);
      
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
  
  return { success: false, error: 'Nenhuma ação encontrada' };
}
