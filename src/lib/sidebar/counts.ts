import type { ItemKind } from "@/types/supabase";

/** One row of the `item_counts` view (nullable because Postgres views are). */
export type ItemCountRow = {
  kind: ItemKind | null;
  collection_id: string | null;
  is_read: boolean | null;
  is_favorite: boolean | null;
  archived: boolean | null;
  deleted: boolean | null;
  n: number | null;
};

export type SidebarCounts = {
  inbox: number;
  all: number;
  unread: number;
  favorites: number;
  archive: number;
  trash: number;
  kinds: Partial<Record<ItemKind, number>>;
  collections: Record<string, number>;
};

/** Sums `item_counts` rows using the same rules as the view filters in fetchItemsPage. */
export function summarizeCounts(rows: ItemCountRow[]): SidebarCounts {
  const counts: SidebarCounts = {
    inbox: 0,
    all: 0,
    unread: 0,
    favorites: 0,
    archive: 0,
    trash: 0,
    kinds: {},
    collections: {},
  };

  for (const row of rows) {
    const n = row.n ?? 0;
    if (n === 0) continue;

    if (row.deleted) {
      counts.trash += n;
      continue;
    }
    if (row.archived) {
      counts.archive += n;
      continue;
    }

    // Live: not archived, not deleted.
    counts.all += n;
    if (row.collection_id === null) counts.inbox += n;
    if (row.is_read === false) counts.unread += n;
    if (row.is_favorite) counts.favorites += n;
    if (row.kind) counts.kinds[row.kind] = (counts.kinds[row.kind] ?? 0) + n;
    if (row.collection_id) {
      counts.collections[row.collection_id] = (counts.collections[row.collection_id] ?? 0) + n;
    }
  }

  return counts;
}
