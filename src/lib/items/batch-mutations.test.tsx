import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveLocale } from "@/i18n/active";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import { makeCounts, makeItem, makeTestQueryClient } from "@/test/fixtures";
import {
  batchMessage,
  batchPatch,
  planBatch,
  useBatchMove,
  type BatchAction,
} from "./batch-mutations";
import { itemQueryKey, itemTagsQueryKey } from "./item-query";
import { itemsQueryKey, type BoardItem, type ItemsPage } from "./queries";

const COLLECTION = "33333333-3333-4333-8333-333333333333";
const TAG = "44444444-4444-4444-8444-444444444444";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(
    vi.fn<(message: string, options?: unknown) => string>(() => "toast-id"),
    { error: vi.fn(), dismiss: vi.fn() },
  ),
  client: undefined as unknown,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

// ---------------------------------------------------------------------------
// A Supabase stand-in that counts requests and lets the test hold a result back
// ---------------------------------------------------------------------------

type Result = { error: unknown };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeFakeClient() {
  const state = {
    /** Every request that reached the "network", in order. */
    requests: [] as {
      table: string;
      op: string;
      patch?: unknown;
      ids?: string[];
      rows?: unknown;
    }[],
    options: undefined as unknown,
    result: (): Promise<Result> | Result => ({ error: null }),
  };
  const thenable = (run: () => Promise<Result>) => ({
    then: (resolve: (value: Result) => void, reject: (reason: unknown) => void) =>
      run().then(resolve, reject),
  });
  const client = {
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          state.requests.push({ table: bucket, op: "remove", ids: paths });
          return state.result();
        },
      }),
    },
    from(table: string) {
      return {
        update: (patch: unknown) => ({
          in: (_column: string, ids: string[]) =>
            thenable(async () => {
              state.requests.push({ table, op: "update", patch, ids });
              return state.result();
            }),
        }),
        delete: () => ({
          in: (_column: string, ids: string[]) =>
            thenable(async () => {
              state.requests.push({ table, op: "delete", ids });
              return state.result();
            }),
        }),
        upsert: (rows: unknown, options: unknown) =>
          thenable(async () => {
            state.options = options;
            state.requests.push({ table, op: "upsert", rows });
            return state.result();
          }),
      };
    },
  };
  return { client, state };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ids = Array.from({ length: 6 }, (_, index) => `00000000-0000-4000-8000-00000000000${index}`);
const cards = ids.map((id, index) =>
  makeItem({ id, title: `Card ${index}`, position: `a${index}`, is_read: true }),
);
const SELECTED = ids.slice(0, 5);

function pageOf(items: BoardItem[]): InfiniteData<ItemsPage> {
  return { pages: [{ items, nextCursor: null }], pageParams: [null] };
}

const INBOX_KEY = itemsQueryKey({ type: "inbox" }, "manual");
const COLLECTION_KEY = itemsQueryKey({ type: "collection", collectionId: COLLECTION }, "manual");
const FAVORITES_KEY = itemsQueryKey({ type: "favorites" }, "manual");
const ARCHIVE_KEY = itemsQueryKey({ type: "archive" }, "manual");
const TRASH_KEY = itemsQueryKey({ type: "trash" }, "manual");

function setup() {
  const fake = makeFakeClient();
  mocks.client = fake.client;
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(INBOX_KEY, pageOf(cards));
  queryClient.setQueryData(COLLECTION_KEY, pageOf([]));
  queryClient.setQueryData(FAVORITES_KEY, pageOf([]));
  queryClient.setQueryData(ARCHIVE_KEY, pageOf([]));
  queryClient.setQueryData(TRASH_KEY, pageOf([]));
  queryClient.setQueryData<SidebarCounts>(
    ["counts"],
    makeCounts({ inbox: 6, all: 6, kinds: { note: 6 } }),
  );
  // Nothing refetches from the fake client in these tests.
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useBatchMove(), { wrapper });
  const titles = (key: readonly unknown[]) =>
    queryClient
      .getQueryData<InfiniteData<ItemsPage>>(key)
      ?.pages.flatMap((page) => page.items.map((item) => item.title));
  return { ...fake, queryClient, move: hook.result.current, invalidate, titles };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------

describe("planBatch", () => {
  it("leaves out items the action would not change", () => {
    const done = makeItem({ id: ids[1], archived_at: "2026-01-02T00:00:00Z" });
    const plan = planBatch([cards[0]!, done], [ids[0]!, ids[1]!], { type: "archive" });
    expect(plan.ids).toEqual([ids[0]]);
    expect(plan.changes[0]?.after?.archived_at).not.toBeNull();
  });

  it("archives a trashed item out of the trash", () => {
    const trashed = makeItem({ id: ids[0], deleted_at: "2026-01-02T00:00:00Z" });
    const plan = planBatch([trashed], [ids[0]!], { type: "archive" });
    expect(plan.ids).toEqual([ids[0]]);
    expect(plan.changes[0]?.after?.deleted_at).toBeNull();
    expect(plan.changes[0]?.after?.archived_at).not.toBeNull();
  });

  it("plans a delete as rows going away", () => {
    const plan = planBatch(cards, SELECTED, { type: "deleteForever" });
    expect(plan.ids).toEqual(SELECTED);
    expect(plan.changes.every((change) => change.after === null)).toBe(true);
  });

  it("keeps every id for a tag, without row changes", () => {
    const plan = planBatch(cards, SELECTED, { type: "tag", id: TAG });
    expect(plan.ids).toEqual(SELECTED);
    expect(plan.changes).toEqual([]);
  });

  it("ignores ids that are not loaded", () => {
    const plan = planBatch([cards[0]!], [ids[0]!, "unknown"], { type: "favorite" });
    expect(plan.ids).toEqual([ids[0]]);
  });
});

describe("copy in Spanish", () => {
  afterEach(() => setActiveLocale("en"));

  it("builds the toast copy with plurals", () => {
    setActiveLocale("es");
    expect(batchMessage({ type: "collection", id: COLLECTION }, 5, "Lectura")).toBe(
      "Se movieron 5 cosas a Lectura",
    );
    expect(batchMessage({ type: "collection", id: null }, 1)).toBe(
      "Se movió 1 cosa a Bandeja de entrada",
    );
    expect(batchMessage({ type: "trash" }, 3)).toBe("Se movieron 3 cosas a la papelera");
  });
});

describe("copy and patches", () => {
  it("builds the toast copy", () => {
    expect(batchMessage({ type: "collection", id: COLLECTION }, 5, "Reading")).toBe(
      "Moved 5 items to Reading",
    );
    expect(batchMessage({ type: "collection", id: null }, 1)).toBe("Moved 1 item to Inbox");
    expect(batchMessage({ type: "tag", id: TAG }, 2, "later")).toBe("Added #later to 2 items");
    expect(batchMessage({ type: "trash" }, 3)).toBe("Moved 3 items to trash");
  });

  it("maps actions to one row patch", () => {
    expect(batchPatch({ type: "collection", id: null })).toEqual({ collection_id: null });
    expect(batchPatch({ type: "favorite" })).toEqual({ is_favorite: true });
    expect(batchPatch({ type: "restore" })).toEqual({ deleted_at: null });
    expect(batchPatch({ type: "tag", id: TAG })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

describe("useBatchMove: delete forever", () => {
  it("removes the files, then the rows with one request each, and drops them from the trash", async () => {
    const { state, queryClient, move, titles } = setup();
    const trashed = cards.slice(0, 2).map((card) => ({
      ...card,
      deleted_at: "2026-01-02T00:00:00Z",
      file_path: `u/${card.id}/file.pdf`,
    }));
    queryClient.setQueryData(TRASH_KEY, pageOf(trashed));

    await act(async () => {
      await move([ids[0]!, ids[1]!], { type: "deleteForever" });
    });

    expect(titles(TRASH_KEY)).toEqual([]);
    expect(state.requests.map((r) => `${r.table}:${r.op}`)).toEqual([
      expect.stringMatching(/:remove$/),
      "items:delete",
    ]);
    expect(state.requests[1]?.ids).toEqual([ids[0], ids[1]]);
    expect(mocks.toast).toHaveBeenCalledWith("Deleted 2 items forever");
  });
});

describe("useBatchMove: collection", () => {
  it("moves 5 cards with ONE request and shows them moved before it resolves", async () => {
    const { state, queryClient, move, titles } = setup();
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let done!: Promise<boolean>;
    act(() => {
      done = move(SELECTED, { type: "collection", id: COLLECTION }, "Reading");
    });

    // Optimistic: gone from Inbox, in the collection, counts moved, request still pending.
    await waitFor(() => expect(titles(INBOX_KEY)).toEqual(["Card 5"]));
    expect(titles(COLLECTION_KEY)).toEqual(["Card 0", "Card 1", "Card 2", "Card 3", "Card 4"]);
    expect(queryClient.getQueryData<SidebarCounts>(["counts"])).toMatchObject({
      inbox: 1,
      collections: { [COLLECTION]: 5 },
    });
    expect(state.requests).toEqual([
      { table: "items", op: "update", patch: { collection_id: COLLECTION }, ids: SELECTED },
    ]);
    expect(mocks.toast).toHaveBeenCalledWith("Moved 5 items to Reading");

    await act(async () => {
      gate.resolve({ error: null });
      await done;
    });
    await expect(done).resolves.toBe(true);
    expect(state.requests).toHaveLength(1);
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("rolls back the lists, counts and detail entries and toasts on error", async () => {
    const { state, queryClient, move, titles } = setup();
    queryClient.setQueryData(itemQueryKey(ids[0]!), cards[0]);
    const before = {
      inbox: queryClient.getQueryData(INBOX_KEY),
      collection: queryClient.getQueryData(COLLECTION_KEY),
      counts: queryClient.getQueryData(["counts"]),
    };
    const gate = deferred<Result>();
    state.result = () => gate.promise;

    let done!: Promise<boolean>;
    act(() => {
      done = move(SELECTED, { type: "collection", id: COLLECTION }, "Reading");
    });
    await waitFor(() => expect(titles(COLLECTION_KEY)).toHaveLength(5));
    expect(queryClient.getQueryData<BoardItem>(itemQueryKey(ids[0]!))?.collection_id).toBe(
      COLLECTION,
    );

    await act(async () => {
      gate.resolve({ error: new Error("nope") });
      await done;
    });
    await expect(done).resolves.toBe(false);

    expect(queryClient.getQueryData(INBOX_KEY)).toEqual(before.inbox);
    expect(queryClient.getQueryData(COLLECTION_KEY)).toEqual(before.collection);
    expect(queryClient.getQueryData(["counts"])).toEqual(before.counts);
    expect(queryClient.getQueryData<BoardItem>(itemQueryKey(ids[0]!))?.collection_id).toBeNull();
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't move those items.");
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("toast-id");
    expect(state.requests).toHaveLength(1);
  });

  it("sends no request when every item is already there", async () => {
    const { state, move } = setup();
    await act(async () => {
      await expect(move(ids, { type: "collection", id: null })).resolves.toBe(true);
    });
    expect(state.requests).toEqual([]);
  });
});

describe("useBatchMove: other targets", () => {
  it("tags 5 items with one upsert that ignores duplicates", async () => {
    const { state, queryClient, move } = setup();
    queryClient.setQueryData(itemTagsQueryKey(ids[0]!), []);

    await act(async () => {
      await move(SELECTED, { type: "tag", id: TAG }, "later");
    });

    expect(state.requests).toEqual([
      {
        table: "item_tags",
        op: "upsert",
        rows: SELECTED.map((id) => ({ item_id: id, tag_id: TAG })),
      },
    ]);
    expect(state.options).toEqual({ onConflict: "item_id,tag_id", ignoreDuplicates: true });
    expect(queryClient.getQueryData(itemTagsQueryKey(ids[0]!))).toEqual([TAG]);
    expect(mocks.toast).toHaveBeenCalledWith("Added #later to 5 items");
  });

  it("rolls back the cached tags of the items when the upsert fails", async () => {
    const { state, queryClient, move } = setup();
    queryClient.setQueryData(itemTagsQueryKey(ids[0]!), []);
    state.result = () => ({ error: new Error("nope") });

    await act(async () => {
      await move(SELECTED, { type: "tag", id: TAG }, "later");
    });

    expect(queryClient.getQueryData(itemTagsQueryKey(ids[0]!))).toEqual([]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't add that tag.");
  });

  it("favorites 5 items with one update", async () => {
    const { state, move, titles } = setup();
    await act(async () => {
      await move(SELECTED, { type: "favorite" });
    });
    expect(state.requests).toEqual([
      { table: "items", op: "update", patch: { is_favorite: true }, ids: SELECTED },
    ]);
    expect(titles(FAVORITES_KEY)).toHaveLength(5);
  });

  it("archives 5 items with one update, an Undo toast and counts", async () => {
    const { state, queryClient, move, titles } = setup();
    await act(async () => {
      await move(SELECTED, { type: "archive" });
    });

    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]).toMatchObject({ table: "items", op: "update", ids: SELECTED });
    expect(state.requests[0]?.patch).toEqual({ archived_at: expect.any(String), deleted_at: null });
    expect(titles(INBOX_KEY)).toEqual(["Card 5"]);
    expect(titles(ARCHIVE_KEY)).toHaveLength(5);
    expect(queryClient.getQueryData<SidebarCounts>(["counts"])?.archive).toBe(5);

    const [message, options] = mocks.toast.mock.calls[0] ?? [];
    expect(message).toBe("Archived 5 items");
    expect(options).toMatchObject({ action: { label: "Undo" } });
  });

  it("Undo of an archive runs ONE inverse update and brings the items back", async () => {
    const { state, move, titles } = setup();
    await act(async () => {
      await move(SELECTED, { type: "archive" });
    });
    const options = mocks.toast.mock.calls[0]?.[1] as { action: { onClick: () => void } };

    await act(async () => {
      options.action.onClick();
    });
    await waitFor(() => expect(state.requests).toHaveLength(2));
    expect(state.requests[1]).toMatchObject({ patch: { archived_at: null }, ids: SELECTED });
    expect(titles(ARCHIVE_KEY)).toEqual([]);
    expect(titles(INBOX_KEY)).toHaveLength(6);
  });

  it("trashes 5 items with one update and Undo restores them", async () => {
    const { state, move, titles } = setup();
    await act(async () => {
      await move(SELECTED, { type: "trash" });
    });
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]?.patch).toEqual({ deleted_at: expect.any(String) });
    expect(titles(TRASH_KEY)).toHaveLength(5);
    expect(titles(INBOX_KEY)).toEqual(["Card 5"]);
    expect(mocks.toast.mock.calls[0]?.[0]).toBe("Moved 5 items to trash");

    const options = mocks.toast.mock.calls[0]?.[1] as { action: { onClick: () => void } };
    await act(async () => {
      options.action.onClick();
    });
    await waitFor(() => expect(state.requests).toHaveLength(2));
    expect(state.requests[1]).toMatchObject({ patch: { deleted_at: null }, ids: SELECTED });
  });

  it("does not show an Undo toast for a collection move", async () => {
    const { move } = setup();
    const action: BatchAction = { type: "collection", id: COLLECTION };
    await act(async () => {
      await move(SELECTED, action, "Reading");
    });
    expect(mocks.toast).toHaveBeenCalledWith("Moved 5 items to Reading");
  });
});
