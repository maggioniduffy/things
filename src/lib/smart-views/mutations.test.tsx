import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarSmartView } from "@/lib/sidebar/queries";
import { makeTestQueryClient } from "@/test/fixtures";
import { useSmartViewActions } from "./mutations";

const TAG = "44444444-4444-4444-8444-444444444444";
const A: SidebarSmartView = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Unread PDFs",
  icon: "📄",
  position: "a0",
  rules: { kinds: ["pdf"], isRead: false },
};
const B: SidebarSmartView = {
  id: "66666666-6666-4666-8666-666666666666",
  name: "Recent",
  icon: null,
  position: "a1",
  rules: { savedWithinDays: 7 },
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
type Call = { table: string; op: string; payload: unknown; eq?: [string, string] };

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
      const call: Call = { table, op: "", payload: undefined };
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

function setup(initial: SidebarSmartView[] | undefined = [A, B]) {
  const fake = makeFakeClient();
  mocks.client = fake.client;
  const queryClient = makeTestQueryClient();
  if (initial) queryClient.setQueryData(["smart-views"], initial);
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useSmartViewActions(), { wrapper: Wrapper });
  return { ...fake, queryClient, invalidate, actions: () => hook.result.current };
}

const cached = (queryClient: ReturnType<typeof makeTestQueryClient>) =>
  queryClient.getQueryData<SidebarSmartView[]>(["smart-views"]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/app";
});

describe("create", () => {
  it("appends optimistically with a position after the last one and stores clean rules", async () => {
    const { actions, state, queryClient } = setup();
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let pending!: Promise<SidebarSmartView | null>;
    act(() => {
      pending = actions().create({
        name: "  Tagged  ",
        icon: "🏷️",
        rules: { tagIds: [TAG, TAG], kinds: [], query: "  " },
      });
    });
    await waitFor(() => expect(cached(queryClient)).toHaveLength(3));
    const added = cached(queryClient)![2]!;
    expect(added).toMatchObject({ name: "Tagged", icon: "🏷️", rules: { tagIds: [TAG] } });
    expect(added.position > B.position).toBe(true);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({
      table: "smart_views",
      op: "insert",
      payload: {
        id: added.id,
        name: "Tagged",
        icon: "🏷️",
        rules: { tagIds: [TAG] },
        position: added.position,
      },
    });

    gate.resolve({ error: null });
    await expect(pending).resolves.toEqual(added);
  });

  it("starts at a0 when there are no views", async () => {
    const { actions, queryClient } = setup([]);
    await act(async () => {
      await actions().create({ name: "First", rules: {} });
    });
    expect(cached(queryClient)?.[0]).toMatchObject({ name: "First", icon: null, position: "a0" });
  });

  it("rejects an empty or too long name without a request", async () => {
    const { actions, state } = setup([]);
    await act(async () => {
      expect(await actions().create({ name: "   ", rules: {} })).toBeNull();
      expect(await actions().create({ name: "x".repeat(81), rules: {} })).toBeNull();
    });
    expect(state.calls).toEqual([]);
  });

  it("rolls back and toasts when the insert fails", async () => {
    const { actions, state, queryClient } = setup();
    state.result = () => ({ error: { code: "42501" } });
    let result: SidebarSmartView | null | undefined;
    await act(async () => {
      result = await actions().create({ name: "Nope", rules: {} });
    });
    expect(result).toBeNull();
    expect(cached(queryClient)).toEqual([A, B]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't create that smart view.");
  });
});

describe("update", () => {
  it("renames and swaps rules before the update settles, then refetches that view's items", async () => {
    const { actions, state, queryClient, invalidate } = setup();
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let pending!: Promise<boolean>;
    act(() => {
      pending = actions().update(A.id, { name: " Docs ", rules: { kinds: ["document"] } });
    });
    await waitFor(() => expect(cached(queryClient)?.[0]?.name).toBe("Docs"));
    expect(cached(queryClient)?.[0]).toMatchObject({ rules: { kinds: ["document"] } });
    expect(cached(queryClient)?.[1]).toEqual(B);
    expect(state.calls[0]).toMatchObject({
      table: "smart_views",
      op: "update",
      payload: { name: "Docs", rules: { kinds: ["document"] } },
      eq: ["id", A.id],
    });

    gate.resolve({ error: null });
    await expect(pending).resolves.toBe(true);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["smart-views"]);
    expect(keys).toContainEqual(["items", `smart:${A.id}`]);
  });

  it("a rename alone does not refetch items", async () => {
    const { actions, invalidate } = setup();
    await act(async () => {
      await actions().update(A.id, { name: "Renamed" });
    });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).not.toContainEqual(["items", `smart:${A.id}`]);
  });

  it("rolls back and toasts when the update fails", async () => {
    const { actions, state, queryClient } = setup();
    state.result = () => ({ error: { code: "42501" } });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await actions().update(A.id, { name: "Books", rules: {} });
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
  it("drops the view at once and forgets its items", async () => {
    const { actions, state, queryClient } = setup();
    queryClient.setQueryData(["items", `smart:${A.id}`, "newest"], { pages: [], pageParams: [] });
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let pending!: Promise<boolean>;
    act(() => {
      pending = actions().remove(A.id);
    });
    await waitFor(() => expect(cached(queryClient)).toEqual([B]));
    expect(state.calls[0]).toMatchObject({ table: "smart_views", op: "delete", eq: ["id", A.id] });

    gate.resolve({ error: null });
    await expect(pending).resolves.toBe(true);
    expect(queryClient.getQueryData(["items", `smart:${A.id}`, "newest"])).toBeUndefined();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rolls back and toasts when the delete fails, without navigating", async () => {
    mocks.pathname = `/app/v/${A.id}`;
    const { actions, state, queryClient } = setup();
    state.result = () => ({ error: { code: "42501" } });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await actions().remove(A.id);
    });
    expect(ok).toBe(false);
    expect(cached(queryClient)).toEqual([A, B]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't delete that smart view.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("lands on /app after deleting the view being viewed", async () => {
    mocks.pathname = `/app/v/${A.id}`;
    const { actions } = setup();
    await act(async () => {
      await actions().remove(A.id);
    });
    expect(mocks.push).toHaveBeenCalledWith("/app");
  });

  it("stays put when another view is being viewed", async () => {
    mocks.pathname = `/app/v/${B.id}`;
    const { actions } = setup();
    await act(async () => {
      await actions().remove(A.id);
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
