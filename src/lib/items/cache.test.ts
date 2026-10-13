import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { makeCounts, makeItem } from "@/test/fixtures";
import { ITEM_KINDS, viewKey, type ViewSpec } from "@/lib/views";
import {
  addToCounts,
  compareForSort,
  insertSortedInPages,
  itemMatchesView,
  itemStaysInView,
  patchInPages,
  prependToPages,
  removeFromCounts,
  removeFromPages,
  viewFromKey,
} from "./cache";
import type { ItemsPage } from "./queries";

const COLLECTION = "33333333-3333-4333-8333-333333333333";

describe("viewFromKey", () => {
  it("inverts viewKey for every view type", () => {
    const views: ViewSpec[] = [
      { type: "inbox" },
      { type: "all" },
      { type: "unread" },
      { type: "favorites" },
      { type: "archive" },
      { type: "trash" },
      { type: "collection", collectionId: COLLECTION },
      { type: "tag", tagId: COLLECTION },
      { type: "smart", viewId: COLLECTION },
      ...ITEM_KINDS.map((kind): ViewSpec => ({ type: "kind", kind })),
    ];
    for (const view of views) expect(viewFromKey(viewKey(view))).toEqual(view);
  });

  it("returns null for keys viewKey cannot produce", () => {
    for (const key of ["", "nope", "kind:", "kind:spaceship", "collection:", "x:y", "kind"]) {
      expect(viewFromKey(key)).toBeNull();
    }
  });
});

describe("itemMatchesView", () => {
  const live = makeItem({ kind: "link" });

  it("matches the system views like fetchItemsPage", () => {
    expect(itemMatchesView(live, { type: "inbox" })).toBe(true);
    expect(itemMatchesView(makeItem({ collection_id: COLLECTION }), { type: "inbox" })).toBe(false);
    expect(itemMatchesView(live, { type: "all" })).toBe(true);
    expect(itemMatchesView(live, { type: "unread" })).toBe(true);
    expect(itemMatchesView(makeItem({ is_read: true }), { type: "unread" })).toBe(false);
    expect(itemMatchesView(live, { type: "favorites" })).toBe(false);
    expect(itemMatchesView(makeItem({ is_favorite: true }), { type: "favorites" })).toBe(true);
  });

  it("handles archive and trash", () => {
    const archived = makeItem({ archived_at: "2026-01-02T00:00:00Z" });
    const trashed = makeItem({ deleted_at: "2026-01-02T00:00:00Z" });
    const trashedAndArchived = makeItem({ ...archived, deleted_at: "2026-01-03T00:00:00Z" });
    expect(itemMatchesView(archived, { type: "archive" })).toBe(true);
    expect(itemMatchesView(archived, { type: "all" })).toBe(false);
    expect(itemMatchesView(trashed, { type: "trash" })).toBe(true);
    expect(itemMatchesView(trashed, { type: "all" })).toBe(false);
    expect(itemMatchesView(trashedAndArchived, { type: "trash" })).toBe(true);
    expect(itemMatchesView(trashedAndArchived, { type: "archive" })).toBe(false);
    expect(itemMatchesView(live, { type: "trash" })).toBe(false);
  });

  it("handles kind and collection views", () => {
    expect(itemMatchesView(live, { type: "kind", kind: "link" })).toBe(true);
    expect(itemMatchesView(live, { type: "kind", kind: "pdf" })).toBe(false);
    const inCollection = makeItem({ collection_id: COLLECTION });
    expect(itemMatchesView(inCollection, { type: "collection", collectionId: COLLECTION })).toBe(
      true,
    );
    expect(itemMatchesView(live, { type: "collection", collectionId: COLLECTION })).toBe(false);
  });

  it("never matches tag or smart views", () => {
    expect(itemMatchesView(live, { type: "tag", tagId: COLLECTION })).toBe(false);
    expect(itemMatchesView(live, { type: "smart", viewId: COLLECTION })).toBe(false);
  });
});

function pages(...groups: string[][]): InfiniteData<ItemsPage> {
  return {
    pages: groups.map((group, index) => ({
      items: group.map((id) => makeItem({ id, title: id })),
      nextCursor:
        index < groups.length - 1 ? { value: "x", id: group[group.length - 1] ?? "" } : null,
    })),
    pageParams: groups.map(() => null),
  };
}
const ids = (data: InfiniteData<ItemsPage>) => data.pages.map((p) => p.items.map((i) => i.id));

describe("prependToPages", () => {
  it("puts the item first in page 0 and keeps other pages and cursors", () => {
    const data = pages(["a", "b"], ["c"]);
    const next = prependToPages(data, makeItem({ id: "new" }));
    expect(ids(next)).toEqual([["new", "a", "b"], ["c"]]);
    expect(next.pages[0]?.nextCursor).toEqual(data.pages[0]?.nextCursor);
    expect(ids(data)).toEqual([["a", "b"], ["c"]]); // input untouched
  });

  it("does not add an id twice", () => {
    const data = pages(["a"], ["b"]);
    expect(prependToPages(data, makeItem({ id: "b" }))).toBe(data);
  });

  it("creates a page for an empty list", () => {
    expect(ids(prependToPages({ pages: [], pageParams: [] }, makeItem({ id: "n" })))).toEqual([
      ["n"],
    ]);
  });
});

describe("patchInPages", () => {
  it("merges the patch into the matching item only", () => {
    const next = patchInPages(pages(["a"], ["b"]), "b", {
      title: "Patched",
      enrich_status: "done",
    });
    expect(next.pages[1]?.items[0]).toMatchObject({ id: "b", title: "Patched" });
    expect(next.pages[0]?.items[0]?.title).toBe("a");
  });

  it("returns the same object when the id is absent", () => {
    const data = pages(["a"]);
    expect(patchInPages(data, "zzz", { title: "x" })).toBe(data);
  });
});

describe("removeFromPages", () => {
  it("removes the item and keeps the rest", () => {
    expect(ids(removeFromPages(pages(["a", "b"], ["c"]), "b"))).toEqual([["a"], ["c"]]);
  });

  it("returns the same object when the id is absent", () => {
    const data = pages(["a"]);
    expect(removeFromPages(data, "zzz")).toBe(data);
  });
});

describe("addToCounts / removeFromCounts", () => {
  it("counts a live inbox note in inbox, all, unread and its kind", () => {
    const next = addToCounts(makeCounts(), makeItem({ kind: "note" }));
    expect(next).toMatchObject({ inbox: 1, all: 1, unread: 1, favorites: 0, archive: 0, trash: 0 });
    expect(next.kinds).toEqual({ note: 1 });
    expect(next.collections).toEqual({});
  });

  it("counts an item in a collection there instead of the inbox", () => {
    const next = addToCounts(
      makeCounts({ collections: { [COLLECTION]: 2 } }),
      makeItem({ kind: "pdf", collection_id: COLLECTION, is_read: true, is_favorite: true }),
    );
    expect(next).toMatchObject({ inbox: 0, all: 1, unread: 0, favorites: 1 });
    expect(next.collections).toEqual({ [COLLECTION]: 3 });
    expect(next.kinds).toEqual({ pdf: 1 });
  });

  it("counts archived and trashed items only in their own bucket", () => {
    expect(addToCounts(makeCounts(), makeItem({ archived_at: "2026-01-01T00:00:00Z" }))).toEqual(
      makeCounts({ archive: 1 }),
    );
    expect(addToCounts(makeCounts(), makeItem({ deleted_at: "2026-01-01T00:00:00Z" }))).toEqual(
      makeCounts({ trash: 1 }),
    );
  });

  it("does not mutate its input and removeFromCounts reverses add", () => {
    const start = makeCounts({ inbox: 2, all: 5, unread: 3, kinds: { link: 4 } });
    const frozen = structuredClone(start);
    const item = makeItem({ kind: "link", collection_id: COLLECTION });
    const added = addToCounts(start, item);
    expect(start).toEqual(frozen);
    expect(removeFromCounts(added, item)).toEqual(start);
  });

  it("never goes below zero", () => {
    expect(removeFromCounts(makeCounts(), makeItem()).all).toBe(0);
  });
});

describe("itemStaysInView", () => {
  it("follows itemMatchesView, except that tag and smart views keep any live item", () => {
    const live = makeItem();
    expect(itemStaysInView(live, { type: "tag", tagId: COLLECTION })).toBe(true);
    expect(itemStaysInView(live, { type: "smart", viewId: COLLECTION })).toBe(true);
    expect(
      itemStaysInView(makeItem({ archived_at: "2026-01-02T00:00:00Z" }), {
        type: "tag",
        tagId: COLLECTION,
      }),
    ).toBe(false);
    expect(
      itemStaysInView(makeItem({ deleted_at: "2026-01-02T00:00:00Z" }), {
        type: "tag",
        tagId: COLLECTION,
      }),
    ).toBe(false);
    expect(itemStaysInView(live, { type: "favorites" })).toBe(false);
    expect(itemStaysInView(live, { type: "inbox" })).toBe(true);
  });
});

describe("compareForSort", () => {
  const a = makeItem({
    id: "a",
    position: "a1",
    created_at: "2026-01-01T00:00:00Z",
    title: "Alpha",
  });
  const b = makeItem({
    id: "b",
    position: "a2",
    created_at: "2026-01-02T00:00:00Z",
    title: "Bravo",
  });

  it("orders like the database queries", () => {
    expect(compareForSort(a, b, "manual")).toBeLessThan(0);
    expect(compareForSort(a, b, "newest")).toBeGreaterThan(0);
    expect(compareForSort(a, b, "oldest")).toBeLessThan(0);
    expect(compareForSort(a, b, "title")).toBeLessThan(0);
  });

  it("breaks ties by id and sorts null titles last", () => {
    const twin = makeItem({ id: "z", position: "a1", created_at: a.created_at, title: "Alpha" });
    expect(compareForSort(a, twin, "manual")).toBeLessThan(0);
    expect(compareForSort(a, twin, "newest")).toBeGreaterThan(0);
    const untitled = makeItem({ id: "c", title: null });
    expect(compareForSort(untitled, a, "title")).toBeGreaterThan(0);
    expect(compareForSort(a, untitled, "title")).toBeLessThan(0);
  });
});

describe("insertSortedInPages", () => {
  const first = makeItem({ id: "i1", position: "a1" });
  const last = makeItem({ id: "i3", position: "a3" });
  const middle = makeItem({ id: "i2", position: "a2" });
  const ids = (data: InfiniteData<ItemsPage>) =>
    data.pages.map((page) => page.items.map((i) => i.id));

  it("places the item by sort order inside the loaded rows", () => {
    const data: InfiniteData<ItemsPage> = {
      pages: [{ items: [first, last], nextCursor: null }],
      pageParams: [null],
    };
    expect(ids(insertSortedInPages(data, middle, "manual"))).toEqual([["i1", "i2", "i3"]]);
  });

  it("appends to the last page when nothing follows it and no more pages exist", () => {
    const data: InfiniteData<ItemsPage> = {
      pages: [{ items: [first], nextCursor: null }],
      pageParams: [null],
    };
    expect(ids(insertSortedInPages(data, last, "manual"))).toEqual([["i1", "i3"]]);
  });

  it("leaves a list unchanged when the item belongs to a page that is not loaded", () => {
    const data: InfiniteData<ItemsPage> = {
      pages: [{ items: [first], nextCursor: { value: "a1", id: "i1" } }],
      pageParams: [null],
    };
    expect(insertSortedInPages(data, last, "manual")).toBe(data);
  });

  it("leaves a list unchanged when it already holds the item, and handles empty lists", () => {
    const data: InfiniteData<ItemsPage> = {
      pages: [{ items: [first], nextCursor: null }],
      pageParams: [null],
    };
    expect(insertSortedInPages(data, first, "manual")).toBe(data);
    const empty: InfiniteData<ItemsPage> = {
      pages: [{ items: [], nextCursor: null }],
      pageParams: [null],
    };
    expect(ids(insertSortedInPages(empty, first, "newest"))).toEqual([["i1"]]);
    const none: InfiniteData<ItemsPage> = { pages: [], pageParams: [] };
    expect(insertSortedInPages(none, first, "newest")).toBe(none);
  });
});
