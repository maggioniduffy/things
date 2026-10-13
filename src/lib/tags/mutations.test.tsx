import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarTag } from "@/lib/sidebar/queries";
import { makeTestQueryClient } from "@/test/fixtures";
import { itemTagsQueryKey } from "@/lib/items/item-query";
import { useTagActions } from "@/lib/items/state-mutations";
import {
  attachTagNames,
  attachTags,
  ensureTags,
  findTagByName,
  isUniqueViolation,
  normalizeTagName,
  useTagManager,
} from "./mutations";

const THESIS: SidebarTag = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "thesis",
  color: null,
};
const UX: SidebarTag = { id: "55555555-5555-4555-8555-555555555555", name: "ux", color: null };
const ITEM = "00000000-0000-4000-8000-000000000001";

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

// ---------------------------------------------------------------------------
// A Supabase stand-in whose results the test can hold back or fail
// ---------------------------------------------------------------------------

type Result = { data?: unknown; error: unknown };
type Call = {
  table: string;
  op: string;
  payload: unknown;
  options?: unknown;
  eq?: [string, string];
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeFakeClient(serverTags: SidebarTag[] = []) {
  const state = {
    calls: [] as Call[],
    serverTags,
    /** Overrides the result of a write; return undefined for the default. */
    handler: ((): Promise<Result> | Result | undefined => undefined) as (
      call: Call,
    ) => Promise<Result> | Result | undefined,
  };

  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", payload: undefined };
      let single = false;
      const chain = {
        insert(payload: unknown) {
          call.op = "insert";
          call.payload = payload;
          return chain;
        },
        upsert(payload: unknown, options: unknown) {
          call.op = "upsert";
          call.payload = payload;
          call.options = options;
          return chain;
        },
        update(payload: unknown) {
          call.op = "update";
          call.payload = payload;
          return chain;
        },
        delete() {
          call.op = "delete";
          return chain;
        },
        select: () => chain,
        order: () => chain,
        eq(column: string, value: string) {
          call.eq = [column, value];
          return chain;
        },
        single() {
          single = true;
          return chain;
        },
        then(resolve: (value: Result) => void, reject: (reason: unknown) => void) {
          return run().then(resolve, reject);
        },
      };

      async function run(): Promise<Result> {
        state.calls.push(call);
        const custom = await state.handler(call);
        if (custom) return custom;
        if (call.table === "tags" && call.op === "select")
          return { data: state.serverTags, error: null };
        if (call.table === "tags" && call.op === "insert") {
          const rows = (Array.isArray(call.payload) ? call.payload : [call.payload]) as {
            id: string;
            name: string;
          }[];
          const created = rows.map((row) => ({ id: row.id, name: row.name, color: null }));
          return { data: single ? created[0] : created, error: null };
        }
        return { error: null };
      }
      return chain;
    },
  };
  return { client, state };
}

const UNIQUE_ERROR = { code: "23505", message: "duplicate key value" };

function setup(initialTags: SidebarTag[] | undefined = [THESIS], serverTags = initialTags ?? []) {
  const fake = makeFakeClient(serverTags);
  mocks.client = fake.client;
  const queryClient = makeTestQueryClient();
  if (initialTags) queryClient.setQueryData(["tags"], initialTags);
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useTagManager(), { wrapper: Wrapper });
  return { ...fake, queryClient, manager: () => hook.result.current };
}

const tagsOf = (queryClient: ReturnType<typeof makeTestQueryClient>) =>
  queryClient.getQueryData<SidebarTag[]>(["tags"]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/app";
});

// ---------------------------------------------------------------------------

describe("helpers", () => {
  it("normalizes a typed name", () => {
    expect(normalizeTagName("  #  Deep   dive ")).toBe("Deep dive");
    expect(normalizeTagName("##")).toBe("");
  });

  it("finds a tag ignoring case, optionally skipping one id", () => {
    expect(findTagByName([THESIS], "THESIS")).toBe(THESIS);
    expect(findTagByName([THESIS], "thesis", THESIS.id)).toBeUndefined();
  });

  it("recognises a unique violation by code", () => {
    expect(isUniqueViolation(UNIQUE_ERROR)).toBe(true);
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("create", () => {
  it("adds the tag to the cache before the insert settles", async () => {
    const { manager, state, queryClient } = setup([THESIS]);
    const gate = deferred<Result>();
    state.handler = (call) => (call.op === "insert" ? gate.promise : undefined);

    let pending!: Promise<SidebarTag | null>;
    act(() => {
      pending = manager().create("  #UX ");
    });
    await waitFor(() => expect(tagsOf(queryClient)?.map((t) => t.name)).toEqual(["thesis", "UX"]));
    const insert = state.calls.find((call) => call.op === "insert");
    expect(insert?.payload).toMatchObject({ name: "UX" });

    const created = tagsOf(queryClient)![1]!;
    gate.resolve({ data: { id: created.id, name: "UX", color: null }, error: null });
    await expect(pending).resolves.toMatchObject({ id: created.id, name: "UX" });
  });

  it("reuses an existing tag whatever its casing, without writing", async () => {
    const { manager, state } = setup([THESIS]);
    let result: SidebarTag | null = null;
    await act(async () => {
      result = await manager().create("Thesis");
    });
    expect(result).toBe(THESIS);
    expect(state.calls).toEqual([]);
  });

  it("ignores empty and over-long names", async () => {
    const { manager, state } = setup([]);
    await act(async () => {
      expect(await manager().create("  # ")).toBeNull();
      expect(await manager().create("x".repeat(51))).toBeNull();
    });
    expect(state.calls).toEqual([]);
  });

  it("rolls back and toasts when the insert fails", async () => {
    const { manager, state, queryClient } = setup([THESIS]);
    state.handler = (call) => (call.op === "insert" ? { error: { code: "42501" } } : undefined);
    let result: SidebarTag | null | undefined;
    await act(async () => {
      result = await manager().create("ux");
    });
    expect(result).toBeNull();
    expect(tagsOf(queryClient)).toEqual([THESIS]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't create that tag.");
  });

  it("on a unique violation refetches the tags and returns the existing row", async () => {
    // Another tab created "ux" and this tab's cache does not know it yet.
    const { manager, state, queryClient } = setup([THESIS], [THESIS, UX]);
    state.handler = (call) => (call.op === "insert" ? { error: UNIQUE_ERROR } : undefined);
    let result: SidebarTag | null = null;
    await act(async () => {
      result = await manager().create("UX");
    });
    expect(result).toEqual(UX);
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(tagsOf(queryClient)).toEqual([THESIS, UX]);
  });
});

describe("rename", () => {
  it("renames in the cache before the update settles", async () => {
    const { manager, state, queryClient } = setup([THESIS, UX]);
    const gate = deferred<Result>();
    state.handler = (call) => (call.op === "update" ? gate.promise : undefined);

    let pending!: Promise<boolean>;
    act(() => {
      pending = manager().rename(UX.id, "design");
    });
    await waitFor(() =>
      expect(tagsOf(queryClient)?.map((t) => t.name)).toEqual(["design", "thesis"]),
    );
    expect(state.calls.find((call) => call.op === "update")).toMatchObject({
      payload: { name: "design" },
      eq: ["id", UX.id],
    });
    gate.resolve({ error: null });
    await expect(pending).resolves.toBe(true);
  });

  it("rolls back and toasts when the update fails", async () => {
    const { manager, state, queryClient } = setup([THESIS, UX]);
    state.handler = (call) => (call.op === "update" ? { error: { code: "42501" } } : undefined);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await manager().rename(UX.id, "design");
    });
    expect(ok).toBe(false);
    expect(tagsOf(queryClient)).toEqual([THESIS, UX]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't rename that tag.");
  });

  it("explains a server-side name clash", async () => {
    const { manager, state, queryClient } = setup([THESIS, UX]);
    state.handler = (call) => (call.op === "update" ? { error: UNIQUE_ERROR } : undefined);
    await act(async () => {
      await manager().rename(UX.id, "design");
    });
    expect(tagsOf(queryClient)).toEqual([THESIS, UX]);
    expect(mocks.toast.error).toHaveBeenCalledWith("You already have a tag with that name.");
  });

  it("refuses a name another tag has, without writing", async () => {
    const { manager, state } = setup([THESIS, UX]);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await manager().rename(UX.id, "THESIS");
    });
    expect(ok).toBe(false);
    expect(state.calls).toEqual([]);
    expect(mocks.toast.error).toHaveBeenCalledWith("You already have a tag with that name.");
  });

  it("allows changing only the casing of the same tag", async () => {
    const { manager, state, queryClient } = setup([THESIS]);
    await act(async () => {
      expect(await manager().rename(THESIS.id, "Thesis")).toBe(true);
    });
    expect(state.calls.filter((call) => call.op === "update")).toHaveLength(1);
    expect(tagsOf(queryClient)?.[0]?.name).toBe("Thesis");
  });

  it("skips a rename to the name it already has", async () => {
    const { manager, state } = setup([THESIS]);
    await act(async () => {
      expect(await manager().rename(THESIS.id, " thesis ")).toBe(false);
    });
    expect(state.calls).toEqual([]);
  });
});

describe("remove", () => {
  it("drops the tag from the tag list and from item-tag caches at once", async () => {
    const { manager, state, queryClient } = setup([THESIS, UX]);
    queryClient.setQueryData(itemTagsQueryKey(ITEM), [THESIS.id, UX.id]);
    const gate = deferred<Result>();
    state.handler = (call) => (call.op === "delete" ? gate.promise : undefined);

    let pending!: Promise<boolean>;
    act(() => {
      pending = manager().remove(THESIS.id);
    });
    await waitFor(() => expect(tagsOf(queryClient)).toEqual([UX]));
    expect(queryClient.getQueryData(itemTagsQueryKey(ITEM))).toEqual([UX.id]);

    gate.resolve({ error: null });
    await expect(pending).resolves.toBe(true);
    expect(state.calls.find((call) => call.op === "delete")).toMatchObject({
      table: "tags",
      eq: ["id", THESIS.id],
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rolls back both caches and toasts when the delete fails", async () => {
    const { manager, state, queryClient } = setup([THESIS, UX]);
    queryClient.setQueryData(itemTagsQueryKey(ITEM), [THESIS.id]);
    state.handler = (call) => (call.op === "delete" ? { error: { code: "42501" } } : undefined);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await manager().remove(THESIS.id);
    });
    expect(ok).toBe(false);
    expect(tagsOf(queryClient)).toEqual([THESIS, UX]);
    expect(queryClient.getQueryData(itemTagsQueryKey(ITEM))).toEqual([THESIS.id]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't delete that tag.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("goes to /app after deleting the tag being viewed", async () => {
    mocks.pathname = `/app/t/${THESIS.id}`;
    const { manager } = setup([THESIS]);
    await act(async () => {
      await manager().remove(THESIS.id);
    });
    expect(mocks.push).toHaveBeenCalledWith("/app");
  });

  it("stays put when the deleted tag is not the one being viewed", async () => {
    mocks.pathname = `/app/t/${UX.id}`;
    const { manager } = setup([THESIS, UX]);
    await act(async () => {
      await manager().remove(THESIS.id);
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("stays put when the delete fails on the tag's own page", async () => {
    mocks.pathname = `/app/t/${THESIS.id}`;
    const { manager, state } = setup([THESIS]);
    state.handler = (call) => (call.op === "delete" ? { error: { code: "42501" } } : undefined);
    await act(async () => {
      await manager().remove(THESIS.id);
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("ensureTags", () => {
  it("creates the missing tags in one insert and reuses existing ones, case-insensitively", async () => {
    const { client, state, queryClient } = setup([THESIS]);
    const tags = await ensureTags(client as never, queryClient, [
      "Thesis",
      "ux",
      "UX",
      "Deep dive",
    ]);
    expect(tags.map((tag) => tag.name)).toEqual(["thesis", "ux", "Deep dive"]);
    expect(tags[0]).toBe(THESIS);
    const inserts = state.calls.filter((call) => call.op === "insert");
    expect(inserts).toHaveLength(1);
    expect((inserts[0]!.payload as { name: string }[]).map((row) => row.name)).toEqual([
      "ux",
      "Deep dive",
    ]);
    expect(tagsOf(queryClient)?.map((tag) => tag.name)).toEqual(["Deep dive", "thesis", "ux"]);
  });

  it("does not write when every tag exists", async () => {
    const { client, state, queryClient } = setup([THESIS, UX]);
    await expect(ensureTags(client as never, queryClient, ["UX"])).resolves.toEqual([UX]);
    expect(state.calls).toEqual([]);
  });

  it("skips names that are not valid tags", async () => {
    const { client, state, queryClient } = setup([]);
    await expect(
      ensureTags(client as never, queryClient, ["", "  ", "x".repeat(51)]),
    ).resolves.toEqual([]);
    expect(state.calls).toEqual([]);
  });

  it("recovers from a unique violation by refetching, then creating what is still missing", async () => {
    // "ux" exists on the server but not in the cache; "new" does not exist anywhere.
    const { client, state, queryClient } = setup([THESIS], [THESIS, UX]);
    let inserts = 0;
    state.handler = (call) => {
      if (call.op !== "insert") return undefined;
      inserts += 1;
      return inserts === 1 ? { error: UNIQUE_ERROR } : undefined;
    };
    const tags = await ensureTags(client as never, queryClient, ["ux", "new"]);
    expect(tags.map((tag) => tag.name)).toEqual(["ux", "new"]);
    expect(tags[0]).toEqual(UX);
    expect(inserts).toBe(2);
  });

  it("throws on another error and leaves the cache alone", async () => {
    const { client, state, queryClient } = setup([THESIS]);
    state.handler = (call) => (call.op === "insert" ? { error: { code: "42501" } } : undefined);
    await expect(ensureTags(client as never, queryClient, ["ux"])).rejects.toMatchObject({
      code: "42501",
    });
    expect(tagsOf(queryClient)).toEqual([THESIS]);
  });
});

describe("attachTags / attachTagNames", () => {
  it("writes all item_tags rows in one upsert that ignores duplicates", async () => {
    const { client, state } = setup([]);
    await attachTags(client as never, ITEM, [THESIS.id, UX.id]);
    expect(state.calls).toEqual([
      {
        table: "item_tags",
        op: "upsert",
        payload: [
          { item_id: ITEM, tag_id: THESIS.id },
          { item_id: ITEM, tag_id: UX.id },
        ],
        options: { onConflict: "item_id,tag_id", ignoreDuplicates: true },
      },
    ]);
  });

  it("does nothing for no tags", async () => {
    const { client, state } = setup([]);
    await attachTags(client as never, ITEM, []);
    expect(state.calls).toEqual([]);
  });

  it("creates the missing tags and attaches them all, reusing 'thesis'", async () => {
    const { client, state, queryClient } = setup([THESIS]);
    await attachTagNames(client as never, queryClient, ITEM, ["Thesis", "ux"]);
    const upsert = state.calls.find((call) => call.op === "upsert");
    const rows = upsert?.payload as { tag_id: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.tag_id).toBe(THESIS.id);
    expect(
      state.calls.filter((call) => call.table === "tags" && call.op === "insert"),
    ).toHaveLength(1);
  });

  it("toasts instead of throwing when it fails", async () => {
    const { client, state, queryClient } = setup([THESIS]);
    state.handler = (call) => (call.op === "upsert" ? { error: { code: "42501" } } : undefined);
    await attachTagNames(client as never, queryClient, ITEM, ["thesis"]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't add those tags.");
  });
});

describe("useTagActions().addTagsByName", () => {
  function setupActions(initialTags: SidebarTag[] = [THESIS]) {
    const fake = makeFakeClient(initialTags);
    mocks.client = fake.client;
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(["tags"], initialTags);
    queryClient.setQueryData(itemTagsQueryKey(ITEM), []);
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    const hook = renderHook(() => useTagActions(), { wrapper: Wrapper });
    return { ...fake, queryClient, actions: () => hook.result.current };
  }

  it("reuses 'thesis', creates 'ux' and attaches both with one insert", async () => {
    const { actions, state, queryClient } = setupActions();
    await act(async () => {
      await actions().addTagsByName(ITEM, ["Thesis", "ux"]);
    });
    const created = tagsOf(queryClient)!.find((tag) => tag.name === "ux")!;
    expect(created).toBeDefined();
    expect(
      state.calls.filter((call) => call.table === "tags" && call.op === "insert"),
    ).toHaveLength(1);
    const upserts = state.calls.filter((call) => call.op === "upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.payload).toEqual([
      { item_id: ITEM, tag_id: THESIS.id },
      { item_id: ITEM, tag_id: created.id },
    ]);
    expect(queryClient.getQueryData(itemTagsQueryKey(ITEM))).toEqual([THESIS.id, created.id]);
  });

  it("rolls the optimistic attach back when the insert fails", async () => {
    const { actions, state, queryClient } = setupActions();
    state.handler = (call) => (call.op === "upsert" ? { error: { code: "42501" } } : undefined);
    await act(async () => {
      await actions().addTagsByName(ITEM, ["thesis"]);
    });
    expect(queryClient.getQueryData(itemTagsQueryKey(ITEM))).toEqual([]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't add that tag.");
  });

  it("toasts and attaches nothing when a tag cannot be created", async () => {
    const { actions, state } = setupActions();
    state.handler = (call) =>
      call.table === "tags" && call.op === "insert" ? { error: { code: "42501" } } : undefined;
    await act(async () => {
      await actions().addTagsByName(ITEM, ["ux"]);
    });
    expect(state.calls.some((call) => call.op === "upsert")).toBe(false);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't add those tags.");
  });

  it("does nothing without names", async () => {
    const { actions, state } = setupActions();
    await act(async () => {
      await actions().addTagsByName(ITEM, []);
    });
    expect(state.calls).toEqual([]);
  });
});
