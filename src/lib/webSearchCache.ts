// Simple in-memory cache for web_search results.
// Keyed by normalized query, with TTL and max entries (LRU eviction).

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 50;

interface CacheEntry {
  result: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCachedWebSearch(query: string): string | null {
  const key = normalize(query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // refresh LRU order
  cache.delete(key);
  cache.set(key, entry);
  return entry.result;
}

export function setCachedWebSearch(query: string, result: string): void {
  const key = normalize(query);
  cache.set(key, { result, expiresAt: Date.now() + TTL_MS });
  // Evict oldest entries if needed
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function clearWebSearchCache(): void {
  cache.clear();
}
