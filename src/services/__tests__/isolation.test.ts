import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Isolamento entre usuários: toda leitura/escrita/remoção de transações
 * precisa filtrar por user_id (defesa em profundidade além do RLS).
 */

interface Call { table: string; op: string; eqs: Array<[string, unknown]>; payload?: unknown }
const calls: Call[] = [];

function makeBuilder(table: string) {
  const call: Call = { table, op: "select", eqs: [] };
  calls.push(call);
  const b: Record<string, unknown> = {};
  const result = { data: [], error: null };
  const chain = () => b;
  b.select = vi.fn(chain);
  b.order = vi.fn(chain);
  b.insert = vi.fn((p: unknown) => { call.op = "insert"; call.payload = p; return b; });
  b.update = vi.fn((p: unknown) => { call.op = "update"; call.payload = p; return b; });
  b.delete = vi.fn(() => { call.op = "delete"; return b; });
  b.eq = vi.fn((col: string, val: unknown) => { call.eqs.push([col, val]); return b; });
  b.range = vi.fn(() => Promise.resolve(result));
  b.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => makeBuilder(t) },
}));

import {
  fetchUserTransactions,
  updateTransactionById,
  deleteTransactionById,
  deleteUserTransactions,
} from "@/services/transactionService";

const scoped = (c: Call, uid: string) => c.eqs.some(([k, v]) => k === "user_id" && v === uid);

describe("isolamento de dados por usuário", () => {
  beforeEach(() => { calls.length = 0; });

  it("leitura filtra pelo user_id do dono", async () => {
    await fetchUserTransactions("user-A");
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((c) => expect(scoped(c, "user-A")).toBe(true));
  });

  it("edição exige id e user_id", async () => {
    await updateTransactionById("user-A", "tx-1", { amount: 5 });
    expect(calls[0].op).toBe("update");
    expect(scoped(calls[0], "user-A")).toBe(true);
    expect(calls[0].eqs).toContainEqual(["id", "tx-1"]);
  });

  it("remoção de um item não atinge outro usuário", async () => {
    await deleteTransactionById("user-B", "tx-9");
    expect(calls[0].op).toBe("delete");
    expect(scoped(calls[0], "user-B")).toBe(true);
    expect(scoped(calls[0], "user-A")).toBe(false);
  });

  it("limpeza em massa é sempre restrita ao usuário", async () => {
    await deleteUserTransactions("user-A", "expense");
    expect(calls[0].op).toBe("delete");
    expect(scoped(calls[0], "user-A")).toBe(true);
    expect(calls[0].eqs).toContainEqual(["type", "expense"]);
  });
});
