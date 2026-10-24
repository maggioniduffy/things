import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import type { ViewSpec } from "@/lib/views";
import { makeCounts, makeItem, makeTestQueryClient } from "@/test/fixtures";
import { itemQueryKey, itemTagsQueryKey } from "./item-query";
import { itemsQueryKey, type BoardItem, type ItemsPage } from "./queries";
import { statePatch, storagePathsOf, useItemActions, useTagActions } from "./state-mutations";

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
// A Supabase stand-in whose results the test can hold back or fail
// ---------------------------------------------------------------------------

type Result = { error: unknown };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeFakeClient() {
  const state = {
    updates: [] as { id: string; patch: Partial<BoardItem> }[],
    deletes: [] as string[],
    removed: [] as string[][],
    tagInserts: [] as { item_id: string; tag_id: string }[],
    tagDeletes: [] as { item_id: string; tag_id: string }[],
    log: [] as string[],
    result: (): Promise<Result> | Result => ({ error: null }),
    storageResult: (): Promise<Result> | Result => ({ error: null }),
  };
  const thenable = (run: () => Promise<Result>) => ({
    then: (resolve: (value: Result) => void, reject: (reason: unknown) => void) =>
      run().then(resolve, reject),
  });

  const client = {
    from(table: string) {
      return {
        update: (patch: Partial<BoardItem>) => ({
          eq: (_column: string, id: string) =>
            thenable(async () => {
              state.updates.push({ id, patch });
              state.log.push(`update:${table}`);
              return state.result();
            }),
        }),
        delete: () => ({
          eq: (column: string, value: string) => {
            const call = { column, value };
            const run = thenable(async () => {
              state.log.push(`delete:${table}`);
              if (table === "items") state.deletes.push(value);
              return state.result();
            });
            // item_tags deletes chain a second eq().
            return Object.assign(run, {
              in: (_column: string, tagIds: string[]) =>
                thenable(async () => {
                  for (const tagId of tagIds) {
                    state.tagDeletes.push({ item_id: call.value, tag_id: tagId });
                  }
                  return state.result();
                }),
            });
          },
        }),
        upsert: (rows: { item_id: string; tag_id: string }[]) =>
          thenable(async () => {
            state.tagInserts.push(...rows);
            return state.result();
          }),
      };
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          state.removed.push(paths);
          state.log.push("storage:remove");
          return state.storageResult();
        },
      }),
    },
  };
  return { client, state };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OTHER = makeItem({
  id: "00000000-0000-4000-8000-000000000002",
  title: "Other",
  position: "a2",
});
const ITEM = makeItem({
  id: "00000000-0000-4000-8000-000000000001",
  title: "Thing",
  position: "a1",
  kind: "note",
});

const ALL_VIEWS: [ViewSpec, "manual" | "newest"][] = [
  [{ type: "inbox" }, "manual"],
  [{ type: "all" }, "newest"],
  [{ type: "unread" }, "manual"],
  [{ type: "favorites" }, "manual"],
  [{ type: "archive" }, "manual"],
  [{ type: "trash" }, "manual"],
  [{ type: "kind", kind: "note" }, "manual"],
  [{ type: "collection", collectionId: COLLECTION }, "manual"],
  [{ type: "tag", tagId: TAG }, "manual"],
];

function keyOf(view: ViewSpec, sort: string) {
  return itemsQueryKey(view, sort as "manual");
}

function pageOf(items: BoardItem[]): InfiniteData<ItemsPage> {
  return { pages: [{ items, nextCursor: null }], pageParams: [null] };
}

/** Seeds every view's list with the items that belong there, like real fetches would. */
function seed(queryClient: ReturnType<typeof makeTestQueryClient>, item: BoardItem) {
  const matches = (view: ViewSpec, candidate: BoardItem) => {
    const live = !candidate.deleted_at && !candidate.archived_at;
    switch (view.type) {
      case "inbox":
        return live && candidate.collection_id === null;
      case "all":
      case "tag":
        return live;
      case "unread":
        return live && !candidate.is_read;
      case "favorites":
        return live && candidate.is_favorite;
      case "archive":
        return !candidate.deleted_at && !!candidate.archived_at;
      case "trash":
        return !!candidate.deleted_at;
      case "kind":
        return live && candidate.kind === view.kind;
      case "collection":
        return live && candidate.collection_id === view.collectionId;
      default:
        return false;
    }
  };
  for (const [view, sort] of ALL_VIEWS) {
    const items = [item, OTHER].filter((candidate) => matches(view, candidate));
    queryClient.setQueryData(
      keyOf(view, sort),
      pageOf(items.sort((a, b) => a.position.localeCompare(b.position))),
    );
  }
  queryClient.setQueryData(itemQueryKey(item.id), item);
}

/** Counts for OTHER (live, unread, note) plus `item` wherever it stands. */
function countsFor(item: BoardItem): SidebarCounts {
  const live = !item.deleted_at && !item.archived_at;
  const n = live ? 2 : 1;
  return makeCounts({
    inbox: n,
    all: n,
    unread: live && !item.is_read ? 2 : 1,
    favorites: live && item.is_favorite ? 1 : 0,
    archive: !item.deleted_at && item.archived_at ? 1 : 0,
    trash: item.deleted_at ? 1 : 0,
    kinds: { note: n },
  });
}

function setup(item: BoardItem = ITEM) {
  const fake = makeFakeClient();
  mocks.client = fake.client;
  const queryClient = makeTestQueryClient();
  seed(queryClient, item);
  queryClient.setQueryData<SidebarCounts>(["counts"], countsFor(item));

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(() => useItemActions(), { wrapper: Wrapper });
  const ids = (view: ViewSpec, sort: "manual" | "newest" = "manual") =>
    queryClient
      .getQueryData<InfiniteData<ItemsPage>>(keyOf(view, sort))
      ?.pages.flatMap((page) => page.items.map((candidate) => candidate.id));
  const counts = () => queryClient.getQueryData<SidebarCounts>(["counts"]);
  const detail = () => queryClient.getQueryData<BoardItem | null>(itemQueryKey(item.id));
  return { fake, queryClient, actions: hook.result, Wrapper, ids, counts, detail };
}

const INBOX: ViewSpec = { type: "inbox" };

function undoAction(callIndex = 0): () => void {
  const calls = mocks.toast.mock.calls as unknown as [
    string,
    { action: { label: string; onClick: () => void } },
  ][];
  const call = calls[callIndex];
  if (!call) throw new Error("No toast was shown.");
  expect(call[1].action.label).toBe("Undo");
  return call[1].action.onClick;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("statePatch", () => {
  const NOW = "2026-05-01T10:00:00.000Z";

  it("maps each action to its column", () => {
    expect(statePatch("trash", ITEM, NOW)).toEqual({ deleted_at: NOW });
    expect(statePatch("restore", ITEM, NOW)).toEqual({ deleted_at: null });
    expect(statePatch("archive", ITEM, NOW)).toEqual({ archived_at: NOW });
    expect(statePatch("unarchive", ITEM, NOW)).toEqual({ archived_at: null });
    expect(statePatch("read", ITEM, NOW)).toEqual({ is_read: true });
  });

  it("toggles the favorite flag from the current row", () => {
    expect(statePatch("favorite", ITEM)).toEqual({ is_favorite: true });
    expect(statePatch("favorite", makeItem({ is_favorite: true }))).toEqual({ is_favorite: false });
  });
});

describe("storagePathsOf", () => {
  it("lists the file and the thumbnail once", () => {
    const item = makeItem({
      id: "i1",
      user_id: "u1",
      file_path: "u1/i1/a.pdf",
      thumbnail_path: "u1/i1/.thumb.webp",
    });
    expect(storagePathsOf(item)).toEqual(["u1/i1/a.pdf", "u1/i1/.thumb.webp"]);
  });

  it("still covers the thumbnail path of an item that has no file", () => {
    expect(storagePathsOf(makeItem({ id: "i1", user_id: "u1" }))).toEqual(["u1/i1/.thumb.webp"]);
  });
});

// ---------------------------------------------------------------------------
// Optimistic state changes
// ---------------------------------------------------------------------------

describe("trash", () => {
  it("removes the card and moves counts before the network answers", async () => {
    const { fake, actions, ids, counts, detail } = setup();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;

    let done!: Promise<void>;
    act(() => {
      done = actions.current.trash(ITEM);
    });

    await waitFor(() => expect(ids(INBOX)).toEqual([OTHER.id]));
    expect(ids({ type: "all" }, "newest")).toEqual([OTHER.id]);
    expect(ids({ type: "kind", kind: "note" })).toEqual([OTHER.id]);
    // The tag view keeps nothing that is trashed; the trash view gains the card.
    expect(ids({ type: "tag", tagId: TAG })).toEqual([OTHER.id]);
    expect(ids({ type: "trash" })).toEqual([ITEM.id]);
    expect(counts()).toMatchObject({ inbox: 1, all: 1, unread: 1, trash: 1 });
    expect(detail()?.deleted_at).toEqual(expect.any(String));
    // Nothing has been confirmed by the database yet.
    expect(fake.state.updates).toHaveLength(1);

    await act(async () => {
      gate.resolve({ error: null });
      await done;
    });
    expect(fake.state.updates[0]).toEqual({
      id: ITEM.id,
      patch: { deleted_at: expect.any(String) },
    });
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("rolls everything back when the write fails", async () => {
    const { fake, actions, ids, counts, detail } = setup();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;

    let done!: Promise<void>;
    act(() => {
      done = actions.current.trash(ITEM);
    });
    await waitFor(() => expect(ids(INBOX)).toEqual([OTHER.id]));

    await act(async () => {
      gate.resolve({ error: new Error("boom") });
      await done;
    });

    expect(ids(INBOX)).toEqual([ITEM.id, OTHER.id]);
    expect(ids({ type: "trash" })).toEqual([]);
    expect(counts()).toEqual(countsFor(ITEM));
    expect(detail()).toEqual(ITEM);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't move to trash.");
    // The Undo toast for a change that did not happen goes away.
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("toast-id");
  });

  it("shows an Undo toast whose action runs the inverse mutation", async () => {
    const { fake, actions, ids, counts } = setup();
    await act(async () => {
      await actions.current.trash(ITEM);
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      "Moved to trash",
      expect.objectContaining({ duration: 5000 }),
    );
    expect(ids(INBOX)).toEqual([OTHER.id]);

    const onUndo = undoAction();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    act(() => onUndo());

    // The card is back in place (position order), counts restored, before the write returns.
    await waitFor(() => expect(ids(INBOX)).toEqual([ITEM.id, OTHER.id]));
    expect(ids({ type: "trash" })).toEqual([]);
    expect(counts()).toEqual(countsFor(ITEM));
    await act(async () => {
      gate.resolve({ error: null });
      await gate.promise;
    });
    expect(fake.state.updates.at(-1)).toEqual({ id: ITEM.id, patch: { deleted_at: null } });
  });
});

describe("restore, archive and unarchive", () => {
  const TRASHED = makeItem({ ...ITEM, deleted_at: "2026-02-01T00:00:00Z" });
  const ARCHIVED = makeItem({ ...ITEM, archived_at: "2026-02-01T00:00:00Z" });

  it("restore moves a trashed card back to its views and shows an Undo toast", async () => {
    const { fake, actions, ids, counts } = setup(TRASHED);
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    act(() => {
      void actions.current.restore(TRASHED);
    });
    await waitFor(() => expect(ids({ type: "trash" })).toEqual([]));
    expect(ids(INBOX)).toContain(ITEM.id);
    expect(counts()).toMatchObject({ trash: 0, inbox: 2, all: 2 });
    expect(mocks.toast.mock.calls[0]?.[0]).toBe("Restored");
    act(() => gate.resolve({ error: null }));
  });

  it("archive removes the card from live views and the Undo unarchives it", async () => {
    const { fake, actions, ids, counts } = setup();
    await act(async () => {
      await actions.current.archive(ITEM);
    });
    expect(ids(INBOX)).toEqual([OTHER.id]);
    expect(ids({ type: "archive" })).toEqual([ITEM.id]);
    expect(counts()).toMatchObject({ inbox: 1, archive: 1 });
    expect(fake.state.updates[0]?.patch).toEqual({ archived_at: expect.any(String) });
    expect(mocks.toast.mock.calls[0]?.[0]).toBe("Archived");

    const onUndo = undoAction();
    await act(async () => {
      onUndo();
      await waitFor(() => expect(ids(INBOX)).toEqual([ITEM.id, OTHER.id]));
    });
    expect(fake.state.updates.at(-1)?.patch).toEqual({ archived_at: null });
    expect(ids({ type: "archive" })).toEqual([]);
  });

  it("unarchive returns the card to its views", async () => {
    const { actions, ids, counts } = setup(ARCHIVED);
    await act(async () => {
      await actions.current.unarchive(ARCHIVED);
    });
    expect(ids({ type: "archive" })).toEqual([]);
    expect(ids(INBOX)).toContain(ITEM.id);
    expect(counts()).toMatchObject({ archive: 0, inbox: 2 });
    expect(mocks.toast.mock.calls[0]?.[0]).toBe("Unarchived");
  });

  it.each([
    ["restore", TRASHED, "Couldn't restore that."],
    ["archive", ITEM, "Couldn't archive that."],
    ["unarchive", ARCHIVED, "Couldn't unarchive that."],
  ] as const)("%s rolls back and reports a failed write", async (name, item, message) => {
    const { fake, actions, queryClient, counts } = setup(item);
    const before = JSON.stringify(queryClient.getQueriesData({ queryKey: ["items"] }));
    fake.state.result = () => ({ error: new Error("boom") });
    await act(async () => {
      await actions.current[name](item);
    });
    expect(JSON.stringify(queryClient.getQueriesData({ queryKey: ["items"] }))).toBe(before);
    expect(counts()).toEqual(countsFor(item));
    expect(mocks.toast.error).toHaveBeenCalledWith(message);
  });
});

describe("favorite", () => {
  it("toggles optimistically, fills the Favorites list and adjusts counts, without a toast", async () => {
    const { fake, actions, ids, counts, detail } = setup();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    act(() => {
      void actions.current.toggleFavorite(ITEM);
    });
    await waitFor(() => expect(ids({ type: "favorites" })).toEqual([ITEM.id]));
    expect(ids(INBOX)).toEqual([ITEM.id, OTHER.id]);
    expect(counts()?.favorites).toBe(1);
    expect(detail()?.is_favorite).toBe(true);
    expect(mocks.toast).not.toHaveBeenCalled();
    await act(async () => gate.resolve({ error: null }));
    expect(fake.state.updates[0]?.patch).toEqual({ is_favorite: true });
  });

  it("removes the card from Favorites when unfavorited, and rolls back on error", async () => {
    const favorite = makeItem({ ...ITEM, is_favorite: true });
    const { fake, actions, ids, counts } = setup(favorite);
    expect(ids({ type: "favorites" })).toEqual([ITEM.id]);

    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    let done!: Promise<void>;
    act(() => {
      done = actions.current.toggleFavorite(favorite);
    });
    await waitFor(() => expect(ids({ type: "favorites" })).toEqual([]));
    expect(counts()?.favorites).toBe(0);

    await act(async () => {
      gate.resolve({ error: new Error("boom") });
      await done;
    });
    expect(ids({ type: "favorites" })).toEqual([ITEM.id]);
    expect(counts()?.favorites).toBe(1);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't update favorite.");
  });
});

describe("markRead", () => {
  it("marks an unread item read: out of Unread, counts down, one write", async () => {
    const { fake, actions, ids, counts, detail } = setup();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    act(() => {
      void actions.current.markRead(ITEM);
    });
    await waitFor(() => expect(ids({ type: "unread" })).toEqual([OTHER.id]));
    expect(counts()?.unread).toBe(1);
    expect(detail()?.is_read).toBe(true);
    await act(async () => gate.resolve({ error: null }));
    expect(fake.state.updates).toEqual([{ id: ITEM.id, patch: { is_read: true } }]);
  });

  it("does nothing for an item that is already read", async () => {
    const read = makeItem({ ...ITEM, is_read: true });
    const { fake, actions } = setup(read);
    await act(async () => {
      await actions.current.markRead(read);
    });
    expect(fake.state.updates).toEqual([]);
  });

  it("rolls back when the write fails", async () => {
    const { fake, actions, ids, counts } = setup();
    fake.state.result = () => ({ error: new Error("boom") });
    await act(async () => {
      await actions.current.markRead(ITEM);
    });
    expect(ids({ type: "unread" })).toEqual([ITEM.id, OTHER.id]);
    expect(counts()?.unread).toBe(2);
  });
});

describe("edit", () => {
  it("saves a title optimistically in every list and the drawer's copy", async () => {
    const { fake, actions, queryClient, detail } = setup();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    act(() => {
      void actions.current.edit(ITEM, { title: "Renamed" });
    });
    await waitFor(() => expect(detail()?.title).toBe("Renamed"));
    const inbox = queryClient.getQueryData<InfiniteData<ItemsPage>>(keyOf(INBOX, "manual"));
    expect(inbox?.pages[0]?.items[0]?.title).toBe("Renamed");
    await act(async () => gate.resolve({ error: null }));
    expect(fake.state.updates[0]).toEqual({ id: ITEM.id, patch: { title: "Renamed" } });
  });

  it("moves the card between collections and rolls back on error", async () => {
    const { fake, actions, ids, counts } = setup();
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    let done!: Promise<void>;
    act(() => {
      done = actions.current.edit(ITEM, { collection_id: COLLECTION });
    });
    await waitFor(() => expect(ids(INBOX)).toEqual([OTHER.id]));
    expect(ids({ type: "collection", collectionId: COLLECTION })).toEqual([ITEM.id]);
    expect(counts()).toMatchObject({ inbox: 1, collections: { [COLLECTION]: 1 } });

    await act(async () => {
      gate.resolve({ error: new Error("boom") });
      await done;
    });
    expect(ids(INBOX)).toEqual([ITEM.id, OTHER.id]);
    expect(ids({ type: "collection", collectionId: COLLECTION })).toEqual([]);
    expect(counts()).toEqual(countsFor(ITEM));
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't save your changes.");
  });
});

describe("deleteForever", () => {
  const TRASHED = makeItem({
    ...ITEM,
    deleted_at: "2026-02-01T00:00:00Z",
    file_path: `u/${ITEM.id}/a.pdf`,
    user_id: "u",
  });

  it("removes the card at once, deletes the storage objects, then the row", async () => {
    const { fake, actions, ids, counts, detail } = setup(TRASHED);
    const gate = deferred<Result>();
    fake.state.storageResult = () => gate.promise;
    let done!: Promise<void>;
    act(() => {
      done = actions.current.deleteForever(TRASHED);
    });
    await waitFor(() => expect(ids({ type: "trash" })).toEqual([]));
    expect(counts()?.trash).toBe(0);
    expect(detail()).toBeNull();
    expect(fake.state.deletes).toEqual([]);

    await act(async () => {
      gate.resolve({ error: null });
      await done;
    });
    expect(
      fake.state.log.filter((entry) => entry.startsWith("storage") || entry === "delete:items"),
    ).toEqual(["storage:remove", "delete:items"]);
    expect(fake.state.removed[0]).toContain(`u/${ITEM.id}/a.pdf`);
    expect(fake.state.deletes).toEqual([ITEM.id]);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps the row and brings the card back when the storage delete fails", async () => {
    const { fake, actions, ids } = setup(TRASHED);
    fake.state.storageResult = () => ({ error: new Error("denied") });
    await act(async () => {
      await actions.current.deleteForever(TRASHED);
    });
    expect(fake.state.deletes).toEqual([]);
    expect(ids({ type: "trash" })).toEqual([ITEM.id]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't delete that.");
  });
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

describe("tag actions", () => {
  function setupTags(initial: string[]) {
    const fake = makeFakeClient();
    mocks.client = fake.client;
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(itemTagsQueryKey(ITEM.id), initial);
    queryClient.setQueryData(keyOf({ type: "tag", tagId: TAG }, "manual"), pageOf([ITEM, OTHER]));
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    const hook = renderHook(() => useTagActions(), { wrapper: Wrapper });
    const tags = () => queryClient.getQueryData<string[]>(itemTagsQueryKey(ITEM.id));
    return { fake, queryClient, actions: hook.result, tags };
  }

  it("adds a tag optimistically", async () => {
    const { fake, actions, tags } = setupTags([]);
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    act(() => {
      void actions.current.addTag(ITEM.id, TAG);
    });
    await waitFor(() => expect(tags()).toEqual([TAG]));
    await act(async () => gate.resolve({ error: null }));
    expect(fake.state.tagInserts).toEqual([{ item_id: ITEM.id, tag_id: TAG }]);
  });

  it("removes a tag and drops the card from that tag's view, then rolls back on error", async () => {
    const { fake, queryClient, actions, tags } = setupTags([TAG]);
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    let done!: Promise<void>;
    act(() => {
      done = actions.current.removeTag(ITEM.id, TAG);
    });
    const tagView = () =>
      queryClient
        .getQueryData<InfiniteData<ItemsPage>>(keyOf({ type: "tag", tagId: TAG }, "manual"))
        ?.pages[0]?.items.map((item) => item.id);
    await waitFor(() => expect(tags()).toEqual([]));
    expect(tagView()).toEqual([OTHER.id]);

    await act(async () => {
      gate.resolve({ error: new Error("boom") });
      await done;
    });
    expect(tags()).toEqual([TAG]);
    expect(tagView()).toEqual([ITEM.id, OTHER.id]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't remove that tag.");
  });

  it("adds the card to the tag's view when the tag is attached, and rolls back on error", async () => {
    const { fake, queryClient, actions } = setupTags([]);
    const key = keyOf({ type: "tag", tagId: TAG }, "manual");
    queryClient.setQueryData(key, pageOf([OTHER]));
    queryClient.setQueryData(itemQueryKey(ITEM.id), ITEM);
    queryClient.setQueryData(keyOf(INBOX, "manual"), pageOf([ITEM, OTHER]));
    const tagView = () =>
      queryClient.getQueryData<InfiniteData<ItemsPage>>(key)?.pages[0]?.items.map((i) => i.id);
    const gate = deferred<Result>();
    fake.state.result = () => gate.promise;
    let done!: Promise<void>;
    act(() => {
      done = actions.current.addTag(ITEM.id, TAG);
    });
    await waitFor(() => expect(tagView()).toEqual([ITEM.id, OTHER.id]));
    await act(async () => {
      gate.resolve({ error: new Error("boom") });
      await done;
    });
    expect(tagView()).toEqual([OTHER.id]);
  });
});

describe("smart views and search caches", () => {
  const SV = "sv-1";
  const SMART: ViewSpec = { type: "smart", viewId: SV };

  it("adds a favorited item to a cached smart view with isFavorite, and drops it on unfavorite", async () => {
    const { queryClient, actions, ids } = setup();
    queryClient.setQueryData(
      ["smart-views"],
      [{ id: SV, name: "Favs", rules: { isFavorite: true } }],
    );
    queryClient.setQueryData(keyOf(SMART, "manual"), pageOf([]));
    await act(async () => {
      await actions.current.toggleFavorite(ITEM);
    });
    expect(ids(SMART)).toEqual([ITEM.id]);

    const favorite = makeItem({ ...ITEM, is_favorite: true });
    await act(async () => {
      await actions.current.toggleFavorite(favorite);
    });
    expect(ids(SMART)).toEqual([]);
  });

  it("leaves a smart view with tag rules alone and never inserts into search caches", async () => {
    const { queryClient, actions, ids } = setup();
    queryClient.setQueryData(["smart-views"], [{ id: SV, name: "T", rules: { tagIds: [TAG] } }]);
    queryClient.setQueryData(keyOf(SMART, "manual"), pageOf([]));
    const searchKey = [...keyOf({ type: "favorites" }, "manual"), { search: { text: "x" } }];
    queryClient.setQueryData(searchKey, pageOf([]));
    await act(async () => {
      await actions.current.toggleFavorite(ITEM);
    });
    expect(ids(SMART)).toEqual([]);
    expect(queryClient.getQueryData<InfiniteData<ItemsPage>>(searchKey)?.pages[0]?.items).toEqual(
      [],
    );
  });
});
