import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarCollection } from "@/lib/sidebar/queries";
import { makeCounts, makeTestQueryClient } from "@/test/fixtures";
import { useCollectionActions } from "./mutations";

const A: SidebarCollection = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Reading",
  emoji: "📚",
  color: null,
  position: "a0",
};
const B: SidebarCollection = {
  id: "66666666-6666-4666-8666-666666666666",
  name: "Work",
  emoji: null,
  color: "blue",
  position: "a1",
};

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/app",
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  client: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

type Result = { error: unknown };
type Call = { op: string; payload: unknown; eq?: [string, string] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeFakeClient() {
  const state = {
    calls: [] as Call[],
    result: ((): Promise<Result> | Result => ({ error: null })) as (
      call: Call,
    ) => Promise<Result> | Result,
  };
  const client = {
    from(table: string) {
      expect(table).toBe("collections");
      const call: Call = { op: "", payload: undefined };
      const chain = {
        insert(payload: unknown) {
          Object.assign(call, { op: "insert", payload });
          return chain;
        },
        update(payload: unknown) {
          Object.assign(call, { op: "update", payload });
          return chain;
        },
        delete() {
          call.op = "delete";
          return chain;
        },
        eq(column: string, value: string) {
          call.eq = [column, value];
          return chain;
        },
        then(resolve: (value: Result) => void, reject: (reason: unknown) => void) {
          state.calls.push(call);
          return Promise.resolve(state.result(call)).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  return { client, state };
}

function setup(initial: SidebarCollection[] | undefined = [A, B]) {
  const fake = makeFakeClient();
  mocks.client = fake.client;
  const queryClient = makeTestQueryClient();
  if (initial) queryClient.setQueryData(["collections"], initial);
  queryClient.setQueryData(["counts"], makeCounts({ inbox: 1 }));
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useCollectionActions(), { wrapper: Wrapper });
  return { ...fake, queryClient, invalidate, actions: () => hook.result.current };
}

const cached = (queryClient: ReturnType<typeof makeTestQueryClient>) =>
  queryClient.getQueryData<SidebarCollection[]>(["collections"]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/app";
});

describe("create", () => {
  it("appends optimistically with a position after the last one", async () => {
    const { actions, state, queryClient } = setup();
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let pending!: Promise<SidebarCollection | null>;
    act(() => {
      pending = actions().create({ name: "  Ideas ", emoji: "💡", color: "violet" });
    });
    await waitFor(() => expect(cached(queryClient)).toHaveLength(3));
    const added = cached(queryClient)![2]!;
    expect(added).toMatchObject({ name: "Ideas", emoji: "💡", color: "violet" });
    expect(added.position > B.position).toBe(true);
    expect(state.calls[0]).toMatchObject({ op: "insert", payload: added });

    gate.resolve({ error: null });
    await expect(pending).resolves.toEqual(added);
  });

  it("starts at a0 when there are no collections", async () => {
    const { actions, queryClient } = setup([]);
    await act(async () => {
      await actions().create({ name: "First" });
    });
    expect(cached(queryClient)?.[0]).toMatchObject({
      name: "First",
      emoji: null,
      color: null,
      position: "a0",
    });
  });

  it("stores an unknown color as none and rejects an empty name", async () => {
    const { actions, state, queryClient } = setup([]);
    await act(async () => {
      expect(await actions().create({ name: "   " })).toBeNull();
      await actions().create({ name: "Odd", color: "#ff0000" });
    });
    expect(state.calls).toHaveLength(1);
    expect(cached(queryClient)?.[0]?.color).toBeNull();
  });

  it("rolls back and toasts when the insert fails", async () => {
    const { actions, state, queryClient } = setup();
    state.result = () => ({ error: { code: "42501" } });
    let result: SidebarCollection | null | undefined;
    await act(async () => {
      result = await actions().create({ name: "Ideas" });
    });
    expect(result).toBeNull();
    expect(cached(queryClient)).toEqual([A, B]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't create that collection.");
  });
});

describe("update", () => {
  it("patches name, emoji and color before the update settles", async () => {
    const { actions, state, queryClient } = setup();
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let pending!: Promise<boolean>;
    act(() => {
      pending = actions().update(A.id, { name: " Books ", emoji: null, color: "pink" });
    });
    await waitFor(() => expect(cached(queryClient)?.[0]?.name).toBe("Books"));
    expect(cached(queryClient)?.[0]).toEqual({
      ...A,
      name: "Books",
      emoji: null,
      color: "pink",
    });
    expect(cached(queryClient)?.[1]).toEqual(B);
    expect(state.calls[0]).toMatchObject({
      op: "update",
      payload: { name: "Books", emoji: null, color: "pink" },
      eq: ["id", A.id],
    });

    gate.resolve({ error: null });
    await expect(pending).resolves.toBe(true);
  });

  it("rolls back and toasts when the update fails", async () => {
    const { actions, state, queryClient } = setup();
    state.result = () => ({ error: { code: "42501" } });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await actions().update(A.id, { name: "Books" });
    });
    expect(ok).toBe(false);
    expect(cached(queryClient)).toEqual([A, B]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't save your changes.");
  });

  it("does not write an empty name or an empty patch", async () => {
    const { actions, state } = setup();
    await act(async () => {
      expect(await actions().update(A.id, { name: "  " })).toBe(false);
      expect(await actions().update(A.id, {})).toBe(false);
    });
    expect(state.calls).toEqual([]);
  });
});

describe("remove", () => {
  it("drops the collection at once, then refetches items and counts", async () => {
    const { actions, state, queryClient, invalidate } = setup();
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let pending!: Promise<boolean>;
    act(() => {
      pending = actions().remove(A.id);
    });
    await waitFor(() => expect(cached(queryClient)).toEqual([B]));
    expect(state.calls[0]).toMatchObject({ op: "delete", eq: ["id", A.id] });

    gate.resolve({ error: null });
    await expect(pending).resolves.toBe(true);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["items"]);
    expect(keys).toContainEqual(["counts"]);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rolls back and toasts when the delete fails, without navigating", async () => {
    mocks.pathname = `/app/c/${A.id}`;
    const { actions, state, queryClient } = setup();
    state.result = () => ({ error: { code: "42501" } });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await actions().remove(A.id);
    });
    expect(ok).toBe(false);
    expect(cached(queryClient)).toEqual([A, B]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't delete that collection.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("lands on /app after deleting the collection being viewed", async () => {
    mocks.pathname = `/app/c/${A.id}`;
    const { actions } = setup();
    await act(async () => {
      await actions().remove(A.id);
    });
    expect(mocks.push).toHaveBeenCalledWith("/app");
  });

  it("stays put when another collection is being viewed", async () => {
    mocks.pathname = `/app/c/${B.id}`;
    const { actions } = setup();
    await act(async () => {
      await actions().remove(A.id);
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
