import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = [string, ...unknown[]];
let calls: Call[] = [];
let dataset: Array<Record<string, unknown>> = [];

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "or", "order"]) {
    b[m] = vi.fn((...args: unknown[]) => { calls.push([m, ...args]); return b; });
  }
  b.limit = vi.fn((n: number) => {
    calls.push(["limit", n]);
    // simula keyset: aplica cursor se houver
    const cur = [...calls].reverse().find(c => c[0] === "or" && String(c[1]).startsWith("transaction_date.lt."));
    let rows = dataset;
    if (cur) {
      const m = /transaction_date\.lt\.([^,]+),and\(transaction_date\.eq\.([^,]+),id\.lt\.([^)]+)\)/.exec(String(cur[1]))!;
      rows = dataset.filter(r => (r.transaction_date as string) < m[1] ||
        (r.transaction_date === m[2] && (r.id as string) < m[3]));
    }
    return Promise.resolve({ data: rows.slice(0, n), error: null });
  });
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => builder() },
}));

import { fetchTransactionsPage, sanitizeSearch } from "../transactionService";

const row = (i: number) => {
  const day = String(28 - Math.floor(i / 2000)).padStart(2, "0");
  return { id: `tx-${String(99999 - i).padStart(5, "0")}`, user_id: "u1", type: "expense", amount: 1,
    category: "outros_despesa", description: null, transaction_date: `2026-01-${day}`, source: "manual" };
};

beforeEach(() => { calls = []; });

describe("fetchTransactionsPage", () => {
  it("retorna 50 por página e cursor da última linha", async () => {
    dataset = Array.from({ length: 120 }, (_, i) => row(i));
    const r = await fetchTransactionsPage("u1");
    expect(r.data).toHaveLength(50);
    expect(r.nextCursor).toEqual({ date: r.data[49].transaction_date, id: r.data[49].id });
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
  });

  it("percorre 50.000 transações sem repetir nem perder nenhuma", async () => {
    dataset = Array.from({ length: 50000 }, (_, i) => row(i));
    const seen = new Set<string>();
    let cursor = null;
    let pages = 0;
    do {
      calls = [];
      const r = await fetchTransactionsPage("u1", { cursor, limit: 200 });
      r.data.forEach(t => seen.add(t.id));
      cursor = r.nextCursor;
      pages++;
    } while (cursor && pages < 1000);
    expect(seen.size).toBe(50000);
    expect(pages).toBe(250);
  });

  it("aplica filtros de tipo, categoria, período e texto no servidor", async () => {
    dataset = [];
    await fetchTransactionsPage("u1", { filters: { type: "expense", category: "lazer",
      startDate: "2026-01-01", endDate: "2026-01-31", search: "uber" } });
    expect(calls).toContainEqual(["eq", "type", "expense"]);
    expect(calls).toContainEqual(["eq", "category", "lazer"]);
    expect(calls).toContainEqual(["gte", "transaction_date", "2026-01-01"]);
    expect(calls).toContainEqual(["lte", "transaction_date", "2026-01-31"]);
    expect(calls).toContainEqual(["or", "description.ilike.*uber*,category.ilike.*uber*,institution.ilike.*uber*"]);
  });

  it("remove caracteres que quebrariam o filtro de busca", () => {
    expect(sanitizeSearch("a,b(c)%d")).toBe("a b c d");
  });
});

describe("fetchTransactionsInRange", () => {
  it("junta todos os blocos do período", async () => {
    const { fetchTransactionsInRange } = await import("../transactionService");
    dataset = Array.from({ length: 1234 }, (_, i) => row(i));
    const r = await fetchTransactionsInRange("u1", { startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(r.data).toHaveLength(1234);
  });
});
