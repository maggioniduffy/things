import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "@/test/fixtures";
import { applySidebarPositions, useSidebarReorder, type SidebarOrderSection } from "./reorder";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  client: undefined as unknown,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

type Row = { id: string; name: string; position: string };
const ROWS: Row[] = [
  { id: "a", name: "A", position: "a0" },
  { id: "b", name: "B", position: "a1" },
  { id: "c", name: "C", position: "a2" },
  { id: "d", name: "D", position: "a3" },
];

type Call = { table: string; payload: unknown; eq?: [string, string] };

function setup(section: SidebarOrderSection, rows: Row[] = ROWS) {
  const calls: Call[] = [];
  const state = { error: null as unknown };
  mocks.client = {
    from(table: string) {
      const call: Call = { table, payload: undefined };
      const chain = {
        update(payload: unknown) {
          call.payload = payload;
          return chain;
        },
        eq(column: string, value: string) {
          call.eq = [column, value];
          return chain;
        },
        then(resolve: (value: { error: unknown }) => void) {
          calls.push(call);
          return Promise.resolve({ error: state.error }).then(resolve);
        },
      };
      return chain;
    },
  };
  const queryClient = makeTestQueryClient();
  const key = section === "collections" ? ["collections"] : ["smart-views"];
  queryClient.setQueryData(key, rows);
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useSidebarReorder(section), { wrapper: Wrapper });
  const ids = () => queryClient.getQueryData<Row[]>(key)?.map((row) => row.id);
  return { calls, state, reorder: () => hook.result.current, ids, queryClient, key };
}

beforeEach(() => vi.clearAllMocks());

describe("applySidebarPositions", () => {
  it("re-sorts by position then id", () => {
    const next = applySidebarPositions(ROWS, [{ id: "a", position: "a1V" }]);
    expect(next.map((row) => row.id)).toEqual(["b", "a", "c", "d"]);
    expect(next[1]).toEqual({ id: "a", name: "A", position: "a1V" });
  });
});

describe.each([
  ["collections", "collections"],
  ["smart-views", "smart_views"],
] as const)("useSidebarReorder (%s)", (section, table) => {
  it("writes exactly one row: a key between the new neighbours", async () => {
    const { calls, reorder, ids } = setup(section);
    await act(async () => {
      await reorder()("a", 2);
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table, eq: ["id", "a"] });
    const position = (calls[0]!.payload as { position: string }).position;
    expect(position > "a2" && position < "a3").toBe(true);
    expect(ids()).toEqual(["b", "c", "a", "d"]);
  });

  it("moves to the first and last place", async () => {
    const first = setup(section);
    await act(async () => {
      await first.reorder()("c", 0);
    });
    expect(first.calls).toHaveLength(1);
    expect((first.calls[0]!.payload as { position: string }).position < "a0").toBe(true);
    expect(first.ids()).toEqual(["c", "a", "b", "d"]);

    const last = setup(section);
    await act(async () => {
      await last.reorder()("a", 3);
    });
    expect(last.calls).toHaveLength(1);
    expect((last.calls[0]!.payload as { position: string }).position > "a3").toBe(true);
    expect(last.ids()).toEqual(["b", "c", "d", "a"]);
  });

  it("changes the cache before the request settles", async () => {
    const { reorder, ids } = setup(section);
    let pending!: Promise<void>;
    act(() => {
      pending = reorder()("d", 0);
    });
    // Synchronous: the same tick as the drop.
    expect(ids()).toEqual(["d", "a", "b", "c"]);
    await act(async () => {
      await pending;
    });
  });

  it("does nothing when the row lands where it was", async () => {
    const { calls, reorder, ids } = setup(section);
    await act(async () => {
      await reorder()("b", 1);
      await reorder()("missing", 0);
    });
    expect(calls).toEqual([]);
    expect(ids()).toEqual(["a", "b", "c", "d"]);
  });

  it("rolls back and toasts when the write fails", async () => {
    const { calls, state, reorder, ids } = setup(section);
    state.error = { code: "42501" };
    await act(async () => {
      await reorder()("a", 3);
    });
    expect(calls).toHaveLength(1);
    expect(ids()).toEqual(["a", "b", "c", "d"]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't move that.");
  });

  it("re-keys tied neighbours instead of writing an impossible key", async () => {
    const tied: Row[] = [
      { id: "a", name: "A", position: "a0" },
      { id: "b", name: "B", position: "a1" },
      { id: "c", name: "C", position: "a1" },
    ];
    const { calls, reorder } = setup(section, tied);
    await act(async () => {
      await reorder()("a", 1);
    });
    expect(calls.length).toBeGreaterThan(1);
  });
});
