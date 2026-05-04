// Robust parsing for AI action responses with normalization
import { z } from 'zod';
import { normalizeAmount, normalizeCategory } from './transactionNormalization';
import { normalizeToLocalDate } from './dateUtils';

// Flexible schema that accepts both number and string for amount
const ActionPayloadSchema = z.object({
  action: z.enum(['add_transaction', 'delete_transaction', 'delete_all_transactions']),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  id: z.string().optional(),
  filter: z.enum(['all', 'income', 'expense']).optional(),
});

const AIResponseSchema = z.object({
  message: z.string(),
  action: ActionPayloadSchema.nullable().optional()
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
  message?: string;
  action?: ParsedAction;
  error?: string;
}

/**
 * Parse and validate AI action response with robust normalization
 */
export function parseAction(jsonString: string): ParseResult {
  try {
    let jsonToParse = jsonString;
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonToParse = jsonString.slice(startIdx, endIdx + 1);
    }
    
    const rawParsed = JSON.parse(jsonToParse);
    
    // Security: Reject prototype pollution attempts
    if ('__proto__' in rawParsed || 'constructor' in rawParsed || 'prototype' in rawParsed) {
      return { success: false, error: 'Propriedades perigosas detectadas' };
    }
    
    // Validate basic structure
    const validation = AIResponseSchema.safeParse(rawParsed);
    if (!validation.success) {
      return { 
        success: false, 
        error: `Formato inválido: ${validation.error.message}` 
      };
    }
    
    const { message, action: rawAction } = validation.data;
    
    if (!rawAction) {
      return { success: true, message };
    }

    // For delete_transaction, we just need the action and id
    if (rawAction.action === 'delete_transaction') {
      if (!rawAction.id) {
        return { success: false, error: 'ID da transação não fornecido' };
      }
      return {
        success: true,
        message,
        action: {
          action: 'delete_transaction',
          id: rawAction.id,
        },
      };
    }
    
    // For delete_all_transactions, validate filter
    if (rawAction.action === 'delete_all_transactions') {
      return {
        success: true,
        message,
        action: {
          action: 'delete_all_transactions',
          filter: rawAction.filter || 'all',
        },
      };
    }
    
    // For add_transaction, validate and normalize all fields
    if (rawAction.action === 'add_transaction') {
      if (!rawAction.type) {
        return { success: false, error: 'Tipo da transação não fornecido' };
      }
      
      const amount = normalizeAmount(rawAction.amount);
      if (amount === null || amount <= 0) {
        return { success: false, error: 'Valor inválido ou não fornecido' };
      }
      
      const description = rawAction.description?.trim() || '';
      const category = normalizeCategory(rawAction.category, rawAction.type, description);
      const date = normalizeToLocalDate(rawAction.date);
      
      return {
        success: true,
        message,
        action: {
          action: 'add_transaction',
          type: rawAction.type,
          amount,
          category,
          description,
          date,
        },
      };
    }
    
    return { success: true, message, error: 'Ação desconhecida ignorada' };
  } catch (e) {
    return { 
      success: false, 
      error: e instanceof Error ? e.message : 'Erro ao processar ação' 
    };
  }
}

/**
 * Extract action from AI response content
 */
export function extractAction(content: string): ParseResult {
  // Support legacy format for compatibility, but prefer JSON parsing
  const actionMatch = content.match(/<!--ACTION:([\s\S]*?)-->/);
  if (actionMatch) {
    try {
      const rawParsed = JSON.parse(actionMatch[1]);
      // Wrap it in the new expected structure
      return parseAction(JSON.stringify({
        message: content.replace(/<!--ACTION:[\s\S]*?-->/g, '').trim(),
        action: rawParsed
      }));
    } catch {
      // Fallback
    }
  }
  
  return parseAction(content);
}
