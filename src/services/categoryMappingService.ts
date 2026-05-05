import { supabase } from '@/integrations/supabase/client';

export interface CategoryMapping {
  id: string;
  category: string;
  description_pattern: string;
  usage_count: number;
}

// Common abbreviations / variations seen in BR bank descriptions
const ABBREVIATIONS: Record<string, string> = {
  SUPERM: 'SUPERMERCADO',
  SUPERMERC: 'SUPERMERCADO',
  MERC: 'MERCADO',
  REST: 'RESTAURANTE',
  RESTAUR: 'RESTAURANTE',
  FARM: 'FARMACIA',
  DROG: 'DROGARIA',
  POSTO: 'POSTO',
  PAG: 'PAGAMENTO',
  PGTO: 'PAGAMENTO',
  PAGTO: 'PAGAMENTO',
  TRANSF: 'TRANSFERENCIA',
  TRANSFER: 'TRANSFERENCIA',
  COMP: 'COMPRA',
  CIA: 'COMPANHIA',
  LTDA: '',
  ME: '',
  EIRELI: '',
  SA: '',
  'S/A': '',
};

// Noise tokens that don't help identify a merchant
const STOPWORDS = new Set([
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'A', 'O', 'AS', 'OS',
  'PIX', 'TED', 'DOC', 'BOLETO', 'CARTAO', 'DEBITO', 'CREDITO',
  'COMPRA', 'PAGAMENTO', 'PAG', 'PGTO', 'COMPRAS', 'PARC',
  'PARCELA', 'INST', 'BR', 'BRA', 'BRASIL', 'SP', 'RJ', 'MG',
]);

/**
 * Normalize a description: uppercase, strip accents, collapse spaces,
 * remove punctuation and trailing numeric noise.
 */
export function normalizePattern(description: string): string {
  if (!description) return '';
  return description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b\d{2,}\b/g, ' ') // strip standalone long numbers (codes)
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

/**
 * Tokenize: split, expand abbreviations, drop stopwords and very short tokens.
 */
function tokenize(description: string): string[] {
  const norm = normalizePattern(description);
  if (!norm) return [];
  const raw = norm.split(' ');
  const out: string[] = [];
  for (const t of raw) {
    if (!t) continue;
    const expanded = ABBREVIATIONS[t] ?? t;
    if (!expanded) continue;
    if (expanded.length < 3) continue;
    if (STOPWORDS.has(expanded)) continue;
    out.push(expanded);
  }
  return out;
}

/**
 * Damerau-Levenshtein distance (cap at maxDist for early exit).
 */
function editDistance(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[a.length][b.length];
}

/**
 * Fuzzy token equality: exact, prefix (abbrev), or small edit distance.
 */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
  }
  const longer = Math.max(a.length, b.length);
  // Allow 1 edit for short tokens, 2 for longer
  const tolerance = longer >= 8 ? 2 : longer >= 5 ? 1 : 0;
  if (tolerance === 0) return false;
  return editDistance(a, b, tolerance) <= tolerance;
}

/**
 * Jaccard-like score on token sets with fuzzy equality.
 * Returns value in [0, 1].
 */
function tokenSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const matched = new Set<number>();
  let matches = 0;
  for (const ta of a) {
    for (let j = 0; j < b.length; j++) {
      if (matched.has(j)) continue;
      if (tokensMatch(ta, b[j])) {
        matches++;
        matched.add(j);
        break;
      }
    }
  }
  const union = a.length + b.length - matches;
  return union === 0 ? 0 : matches / union;
}

export async function getUserCategoryMappings(userId: string): Promise<CategoryMapping[]> {
  const { data, error } = await supabase
    .from('category_mappings')
    .select('*')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false });

  if (error) {
    console.error('[CategoryMapping] Error fetching:', error);
    return [];
  }
  return data || [];
}

/**
 * Find a learned category using:
 *  1. Exact normalized match
 *  2. Substring match
 *  3. Fuzzy token similarity (handles accents, abbreviations, typos)
 */
export function findLearnedCategory(description: string, mappings: CategoryMapping[]): string | null {
  const normalizedDesc = normalizePattern(description);
  if (!normalizedDesc) return null;

  // 1. Exact match
  const exactMatch = mappings.find(m => m.description_pattern === normalizedDesc);
  if (exactMatch) return exactMatch.category;

  // 2. Substring match (either direction)
  for (const mapping of mappings) {
    const p = mapping.description_pattern;
    if (!p) continue;
    if (
      (p.length >= 4 && normalizedDesc.includes(p)) ||
      (normalizedDesc.length >= 4 && p.includes(normalizedDesc))
    ) {
      return mapping.category;
    }
  }

  // 3. Fuzzy token similarity — pick best match above threshold,
  // ties broken by usage_count (mappings already sorted desc).
  const descTokens = tokenize(description);
  if (descTokens.length === 0) return null;

  let best: { category: string; score: number; usage: number } | null = null;
  const THRESHOLD = 0.5;

  for (const mapping of mappings) {
    const mTokens = tokenize(mapping.description_pattern);
    if (mTokens.length === 0) continue;
    const score = tokenSimilarity(descTokens, mTokens);
    if (score >= THRESHOLD) {
      if (
        !best ||
        score > best.score ||
        (score === best.score && mapping.usage_count > best.usage)
      ) {
        best = { category: mapping.category, score, usage: mapping.usage_count };
      }
    }
  }

  return best?.category ?? null;
}

export async function saveSingleLearnedMapping(
  userId: string,
  description: string,
  category: string
): Promise<void> {
  const pattern = normalizePattern(description);
  if (!pattern || !category) return;
  if (category === 'outros_despesa' || category === 'outros_receita') return;

  try {
    const { data: existing } = await supabase
      .from('category_mappings')
      .select('id, usage_count')
      .eq('user_id', userId)
      .eq('description_pattern', pattern)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('category_mappings')
        .update({
          usage_count: existing.usage_count + 1,
          category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('category_mappings')
        .insert({ user_id: userId, description_pattern: pattern, category, usage_count: 1 });
    }
  } catch (e) {
    console.error('[CategoryMapping] Error saving single mapping:', e);
  }
}

export async function saveLearnedMappings(
  userId: string,
  originalRows: any[],
  finalRows: any[]
): Promise<void> {
  const newMappings = new Map<string, string>();

  for (let i = 0; i < finalRows.length; i++) {
    const original = originalRows.find(r => r.id === finalRows[i].id);
    const final = finalRows[i];

    if (
      original && final &&
      original.category !== final.category &&
      final.category !== 'outros_despesa' &&
      final.category !== 'outros_receita' &&
      !final.isLearnedCategory
    ) {
      const pattern = normalizePattern(final.description);
      if (pattern) newMappings.set(pattern, final.category);
    }
  }

  if (newMappings.size === 0) return;

  for (const [pattern, category] of newMappings.entries()) {
    try {
      const { data: existing } = await supabase
        .from('category_mappings')
        .select('id, usage_count')
        .eq('user_id', userId)
        .eq('description_pattern', pattern)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('category_mappings')
          .update({ usage_count: existing.usage_count + 1, category, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('category_mappings')
          .insert({ user_id: userId, description_pattern: pattern, category, usage_count: 1 });
      }
    } catch (e) {
      console.error('[CategoryMapping] Error saving mapping:', e);
    }
  }
}
