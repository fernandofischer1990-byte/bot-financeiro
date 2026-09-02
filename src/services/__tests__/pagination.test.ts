import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Cobre os dois pontos que já causaram truncamento silencioso:
 * - paginação server-side de transações/investimentos (blocos de 1.000)
 * - limite fixo do histórico de chat (últimas 300, em ordem cronológica)
 */

type Row = Record<string, unknown>;

interface Recorded {
  table: string;
  ranges: Array<[number, number]>;
  limits: number[];
}

const recorded: Recorded[] = [];
let responder: (table: string, from: number, to: number) => Row[] = () => [];
let limitResponder: (table: string, limit: number) => Row[] = () => [];

function makeBuilder(table: string) {
  const entry: Recorded = { table, ranges: [], limits: [] };
  recorded.push(entry);

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "order", "insert", "update", "delete"]) {
    builder[method] = vi.fn(chain);
  }
  builder.range = vi.fn((from: number, to: number) => {
    entry.ranges.push([from, to]);
    return Promise.resolve({ data: responder(table, from, to), error: null });
  });
  builder.limit = vi.fn((n: number) => {
    entry.limits.push(n);
    return Promise.resolve({ data: limitResponder(table, n), error: null });
  });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

const txRow = (i: number): Row => ({
  id: `tx-${i}`,
  user_id: "u1",
  type: "expense",
  amount: 10,
  category: "geral",
  description: null,
  transaction_date: "2026-01-05",
  source: "manual",
  created_at: "2026-01-05T00:00:00Z",
  updated_at: "2026-01-05T00:00:00Z",
});

const invRow = (i: number): Row => ({
  id: `inv-${i}`,
  user_id: "u1",
  investment_name: `Ativo ${i}`,
  investment_type: "outros",
  initial_amount: 100,
  metadata: {},
});

const chatRow = (i: number): Row => ({
  id: `msg-${i}`,
  user_id: "u1",
  role: i % 2 === 0 ? "user" : "assistant",
  content: `mensagem ${i}`,
  metadata: null,
  // mais recentes primeiro (como o banco devolve com created_at desc)
  created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 1000 - i)).toISOString(),
});

beforeEach(() => {
  recorded.length = 0;
  responder = () => [];
  limitResponder = () => [];
});

describe("paginação de transações", () => {
  it("busca páginas seguintes até a última página incompleta", async () => {
    const { fetchUserTransactions } = await import("../transactionService");
    const total = 2300;
    responder = (_t, from, to) => {
      const rows: Row[] = [];
      for (let i = from; i <= Math.min(to, total - 1); i++) rows.push(txRow(i));
      return rows;
    };

    const { data, error } = await fetchUserTransactions("u1");
    expect(error).toBeNull();
    expect(data).toHaveLength(total);
    const ranges = recorded.filter(r => r.table === "transactions").flatMap(r => r.ranges);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("para na primeira página quando o total é menor que o tamanho da página", async () => {
    const { fetchUserTransactions } = await import("../transactionService");
    responder = () => [txRow(0), txRow(1)];
    const { data } = await fetchUserTransactions("u1");
    expect(data).toHaveLength(2);
    const ranges = recorded.filter(r => r.table === "transactions").flatMap(r => r.ranges);
    expect(ranges).toHaveLength(1);
  });

  it("rejeita userId inválido sem consultar o banco", async () => {
    const { fetchUserTransactions } = await import("../transactionService");
    const { error } = await fetchUserTransactions("");
    expect(error).toBeTruthy();
    expect(recorded).toHaveLength(0);
  });
});

describe("paginação de investimentos", () => {
  it("agrega todas as páginas", async () => {
    const { fetchUserInvestments } = await import("../investmentService");
    const total = 1500;
    responder = (_t, from, to) => {
      const rows: Row[] = [];
      for (let i = from; i <= Math.min(to, total - 1); i++) rows.push(invRow(i));
      return rows;
    };
    const { data, error } = await fetchUserInvestments("u1");
    expect(error).toBeNull();
    expect(data).toHaveLength(total);
    const ranges = recorded.filter(r => r.table === "investments").flatMap(r => r.ranges);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });
});

describe("histórico de chat paginado", () => {
  it("aplica o limite de 300 mensagens e devolve em ordem cronológica", async () => {
    const { fetchChatMessages, CHAT_HISTORY_LIMIT } = await import("../chatMessagesService");
    expect(CHAT_HISTORY_LIMIT).toBe(300);

    limitResponder = (_t, n) => Array.from({ length: n }, (_v, i) => chatRow(i));

    const { data, error } = await fetchChatMessages("u1");
    expect(error).toBeNull();
    expect(data).toHaveLength(CHAT_HISTORY_LIMIT);

    const limits = recorded.filter(r => r.table === "chat_messages").flatMap(r => r.limits);
    expect(limits).toEqual([CHAT_HISTORY_LIMIT]);

    const dates = (data ?? []).map(m => new Date(m.created_at).getTime());
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
    expect(data?.[data.length - 1]?.id).toBe("msg-0");
  });

  it("não consulta o banco sem userId", async () => {
    const { fetchChatMessages } = await import("../chatMessagesService");
    const { error } = await fetchChatMessages("");
    expect(error).toBeTruthy();
    expect(recorded).toHaveLength(0);
  });
});
