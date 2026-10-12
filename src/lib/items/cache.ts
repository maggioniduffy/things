import type { InfiniteData } from "@tanstack/react-query";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import { ITEM_KINDS, type SystemView, type ViewSpec } from "@/lib/views";
import type { BoardItem, ItemsPage } from "./queries";

// Pure helpers for editing the cached `["items", viewKey, sort]` lists and the `["counts"]` cache
// by hand (optimistic capture, enrichment patches, rollback).

const SYSTEM_VIEWS: readonly SystemView[] = [
  "inbox",
  "all",
  "unread",
  "favorites",
  "archive",
  "trash",
];

/** Inverse of `viewKey`. Returns null for anything `viewKey` cannot have produced. */
export function viewFromKey(key: string): ViewSpec | null {
  const system = SYSTEM_VIEWS.find((view) => view === key);
  if (system) return { type: system };

  const colon = key.indexOf(":");
  if (colon === -1) return null;
  const prefix = key.slice(0, colon);
  const value = key.slice(colon + 1);
  if (value === "") return null;

  switch (prefix) {
    case "kind": {
      const kind = ITEM_KINDS.find((candidate) => candidate === value);
      return kind ? { type: "kind", kind } : null;
    }
    case "collection":
      return { type: "collection", collectionId: value };
    case "tag":
      return { type: "tag", tagId: value };
    case "smart":
      return { type: "smart", viewId: value };
    default:
      return null;
  }
}

/**
 * Whether `item` belongs in `view`, by the same rules as `fetchItemsPage`. Tag and smart views
 * answer false: tag membership lives in another table and smart views arrive in WP 5.4.
 */
export function itemMatchesView(item: BoardItem, view: ViewSpec): boolean {
  const deleted = item.deleted_at !== null;
  const archived = item.archived_at !== null;
  const live = !deleted && !archived;

  switch (view.type) {
    case "inbox":
      return live && item.collection_id === null;
    case "all":
      return live;
    case "unread":
      return live && !item.is_read;
    case "favorites":
      return live && item.is_favorite;
    case "archive":
      return !deleted && archived;
    case "trash":
      return deleted;
    case "kind":
      return live && item.kind === view.kind;
    case "collection":
      return live && item.collection_id === view.collectionId;
    case "tag":
    case "smart":
      return false;
  }
}

type Items = InfiniteData<ItemsPage>;

/** Puts `item` first in page 0. A list that already holds the id comes back unchanged. */
export function prependToPages(data: Items, item: BoardItem): Items {
  if (data.pages.some((page) => page.items.some((existing) => existing.id === item.id))) {
    return data;
  }
  const [first, ...rest] = data.pages;
  if (!first) return { pages: [{ items: [item], nextCursor: null }], pageParams: [null] };
  return { ...data, pages: [{ ...first, items: [item, ...first.items] }, ...rest] };
}

/** Merges `patch` into the item with `id`. A list without that id comes back unchanged. */
export function patchInPages(data: Items, id: string, patch: Partial<BoardItem>): Items {
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => item.id === id)) return page;
    changed = true;
    return {
      ...page,
      items: page.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    };
  });
  return changed ? { ...data, pages } : data;
}

/** Drops the item with `id`. A list without that id comes back unchanged. */
export function removeFromPages(data: Items, id: string): Items {
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => item.id === id)) return page;
    changed = true;
    return { ...page, items: page.items.filter((item) => item.id !== id) };
  });
  return changed ? { ...data, pages } : data;
}

function adjustCounts(counts: SidebarCounts, item: BoardItem, delta: 1 | -1): SidebarCounts {
  const bump = (value: number | undefined) => Math.max(0, (value ?? 0) + delta);

  if (item.deleted_at !== null) return { ...counts, trash: bump(counts.trash) };
  if (item.archived_at !== null) return { ...counts, archive: bump(counts.archive) };

  // Live item: the same buckets as summarizeCounts, which never lists a zero count.
  const next: SidebarCounts = {
    ...counts,
    all: bump(counts.all),
    kinds: { ...counts.kinds, [item.kind]: bump(counts.kinds[item.kind]) },
    collections: { ...counts.collections },
  };
  if (next.kinds[item.kind] === 0) delete next.kinds[item.kind];
  if (item.collection_id === null) next.inbox = bump(counts.inbox);
  else {
    next.collections[item.collection_id] = bump(counts.collections[item.collection_id]);
    if (next.collections[item.collection_id] === 0) delete next.collections[item.collection_id];
  }
  if (!item.is_read) next.unread = bump(counts.unread);
  if (item.is_favorite) next.favorites = bump(counts.favorites);
  return next;
}

/** Sidebar counts after saving `item` (inbox / all / unread / kind / collection / ...). */
export function addToCounts(counts: SidebarCounts, item: BoardItem): SidebarCounts {
  return adjustCounts(counts, item, 1);
}

/** Inverse of `addToCounts`, for rollback. Never goes below zero. */
export function removeFromCounts(counts: SidebarCounts, item: BoardItem): SidebarCounts {
  return adjustCounts(counts, item, -1);
}
