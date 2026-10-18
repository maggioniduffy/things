"use client";

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { toast } from "sonner";
import { undoToast } from "@/components/ui/sonner";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { itemQueryKey, itemTagsQueryKey } from "./item-query";
import { ITEM_STATE_MUTATION_KEY, REORDER_MUTATION_KEY } from "./mutation-keys";
import type { NoteColor } from "./note-colors";
import type { BoardItem, ItemsPage } from "./queries";
import { applyChange } from "./state-mutations";

type Client = SupabaseClient<Database>;
type Items = InfiniteData<ItemsPage>;

/**
 * What a batch does to every item in it. `collection` with a null id means "no collection"
 * (Inbox). `color` only touches notes (null = the default look). `favorite` always sets the flag (a drop never un-favorites). `unarchive` and `restore`
 * exist for the Undo toast of `archive` and `trash`.
 */
export type BatchAction =
  | { type: "collection"; id: string | null }
  | { type: "tag"; id: string }
  | { type: "color"; color: NoteColor | null }
  | { type: "favorite" }
  | { type: "archive" }
  | { type: "trash" }
  | { type: "unarchive" }
  | { type: "restore" };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** The one row patch every item of the batch gets; null for tags (they live in `item_tags`). */
export function batchPatch(
  action: BatchAction,
  now: string = new Date().toISOString(),
): Partial<BoardItem> | null {
  switch (action.type) {
    case "collection":
      return { collection_id: action.id };
    case "color":
      return { color: action.color };
    case "favorite":
      return { is_favorite: true };
    case "archive":
      return { archived_at: now };
    case "trash":
      return { deleted_at: now };
    case "unarchive":
      return { archived_at: null };
    case "restore":
      return { deleted_at: null };
    case "tag":
      return null;
  }
}

/** True when `action` would not change `item`: it is left out of the request. */
function alreadyDone(item: BoardItem, action: BatchAction): boolean {
  switch (action.type) {
    case "collection":
      return item.collection_id === action.id;
    case "color":
      return item.kind !== "note" || item.color === action.color;
    case "favorite":
      return item.is_favorite;
    case "archive":
      return item.archived_at !== null;
    case "trash":
      return item.deleted_at !== null;
    case "unarchive":
      return item.archived_at === null;
    case "restore":
      return item.deleted_at === null;
    case "tag":
      return false;
  }
}

export type BatchPlan = {
  action: BatchAction;
  /** Ids the request writes: the items that change (every id for a tag). */
  ids: string[];
  /** Row changes for the caches; empty for tags. */
  changes: { before: BoardItem; after: BoardItem }[];
};

/** Which of `ids` the action touches, and how their rows look afterwards. */
export function planBatch(
  items: readonly BoardItem[],
  ids: readonly string[],
  action: BatchAction,
  now: string = new Date().toISOString(),
): BatchPlan {
  if (action.type === "tag") return { action, ids: [...new Set(ids)], changes: [] };

  const patch = batchPatch(action, now) ?? {};
  const wanted = new Set(ids);
  const changes = items
    .filter((item) => wanted.has(item.id) && !alreadyDone(item, action))
    .map((before) => ({ before, after: { ...before, ...patch } }));
  return { action, ids: changes.map((change) => change.before.id), changes };
}

function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

/** Toast copy of a batch, e.g. "Moved 5 items to Reading". `label` is the target's name. */
export function batchMessage(action: BatchAction, count: number, label?: string): string {
  const items = itemsLabel(count);
  switch (action.type) {
    case "collection":
      return `Moved ${items} to ${action.id === null ? "Inbox" : (label ?? "the collection")}`;
    case "tag":
      return `Added #${label ?? "tag"} to ${items}`;
    case "color":
      return `Changed the color of ${count} ${count === 1 ? "note" : "notes"}`;
    case "favorite":
      return `Added ${items} to Favorites`;
    case "archive":
      return `Archived ${items}`;
    case "trash":
      return `Moved ${items} to trash`;
    case "unarchive":
      return `Unarchived ${items}`;
    case "restore":
      return `Restored ${items}`;
  }
}

function batchErrorMessage(action: BatchAction): string {
  switch (action.type) {
    case "collection":
      return "Couldn't move those items.";
    case "tag":
      return "Couldn't add that tag.";
    case "color":
      return "Couldn't change the color.";
    case "favorite":
      return "Couldn't update favorites.";
    case "archive":
      return "Couldn't archive those items.";
    case "unarchive":
      return "Couldn't unarchive those items.";
    case "trash":
      return "Couldn't move those items to trash.";
    case "restore":
      return "Couldn't restore those items.";
  }
}

/** The inverse an Undo toast runs, for the actions that have one. */
const INVERSE: Partial<Record<BatchAction["type"], BatchAction>> = {
  archive: { type: "unarchive" },
  unarchive: { type: "archive" },
  trash: { type: "restore" },
  restore: { type: "trash" },
};

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

type Snapshot = {
  lists: [QueryKey, Items | undefined][];
  counts: SidebarCounts | undefined;
  details: [string, BoardItem | null | undefined][];
  itemTags: [string, string[] | undefined][];
};

function snapshotOf(queryClient: QueryClient, ids: readonly string[]): Snapshot {
  return {
    lists: queryClient.getQueriesData<Items>({ queryKey: ["items"] }),
    counts: queryClient.getQueryData<SidebarCounts>(["counts"]),
    details: ids.map((id) => [id, queryClient.getQueryData<BoardItem | null>(itemQueryKey(id))]),
    itemTags: ids.map((id) => [id, queryClient.getQueryData<string[]>(itemTagsQueryKey(id))]),
  };
}

function restore(queryClient: QueryClient, snapshot: Snapshot): void {
  for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
  queryClient.setQueryData(["counts"], snapshot.counts);
  for (const [id, detail] of snapshot.details) {
    if (detail !== undefined) queryClient.setQueryData(itemQueryKey(id), detail);
  }
  for (const [id, tags] of snapshot.itemTags) {
    if (tags !== undefined) queryClient.setQueryData(itemTagsQueryKey(id), tags);
  }
}

/** The loaded rows for `ids`, from any cached list or drawer entry. */
function findCachedItems(queryClient: QueryClient, ids: readonly string[]): BoardItem[] {
  const wanted = new Set(ids);
  const found = new Map<string, BoardItem>();
  for (const [, data] of queryClient.getQueriesData<Items>({ queryKey: ["items"] })) {
    for (const page of data?.pages ?? []) {
      for (const item of page.items) {
        if (wanted.has(item.id) && !found.has(item.id)) found.set(item.id, item);
      }
    }
  }
  for (const id of wanted) {
    if (found.has(id)) continue;
    const detail = queryClient.getQueryData<BoardItem | null>(itemQueryKey(id));
    if (detail) found.set(id, detail);
  }
  return [...found.values()];
}

async function writeBatch(client: Client, plan: BatchPlan): Promise<void> {
  const { action, ids } = plan;
  if (action.type === "tag") {
    // One request for every row; pairs that already exist are ignored.
    const { error } = await client.from("item_tags").upsert(
      ids.map((itemId) => ({ item_id: itemId, tag_id: action.id })),
      { onConflict: "item_id,tag_id", ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }
  const patch = batchPatch(action);
  if (!patch) return;
  const { error } = await client.from("items").update(patch).in("id", ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Moves or changes many items with one request. `label` is the target's display name for the
 * toast. Resolves true when the change was saved or there was nothing to change.
 */
export type BatchMove = (
  ids: readonly string[],
  action: BatchAction,
  label?: string,
) => Promise<boolean>;

/**
 * One optimistic batch mutation: every cached list, the sidebar counts and the drawer copies
 * change at once; one `update(...).in('id', ids)` (or one `item_tags` upsert) saves them; an error
 * rolls everything back and shows a toast. Archive and trash get an Undo toast.
 */
export function useBatchMove(): BatchMove {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ITEM_STATE_MUTATION_KEY,
    mutationFn: ({ plan }: { plan: BatchPlan }) => writeBatch(createClient(), plan),
    onMutate: async ({ plan }) => {
      // A fetch that started before this change would overwrite it with older data.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["items"] }),
        queryClient.cancelQueries({ queryKey: ["counts"] }),
        ...plan.ids.map((id) => queryClient.cancelQueries({ queryKey: itemQueryKey(id) })),
        ...plan.ids.map((id) => queryClient.cancelQueries({ queryKey: itemTagsQueryKey(id) })),
      ]);
      const snapshot = snapshotOf(queryClient, plan.ids);
      if (plan.action.type === "tag") {
        const tagId = plan.action.id;
        for (const id of plan.ids) {
          queryClient.setQueryData<string[]>(itemTagsQueryKey(id), (current) =>
            current && !current.includes(tagId) ? [...current, tagId] : current,
          );
        }
      } else {
        for (const change of plan.changes) applyChange(queryClient, change);
      }
      return snapshot;
    },
    onError: (_error, { plan }, snapshot) => {
      if (snapshot) restore(queryClient, snapshot);
      toast.error(batchErrorMessage(plan.action));
    },
    onSettled: async (_data, _error, { plan }) => {
      // Overlapping changes: only the last one to settle refetches (see useItemActions).
      const inFlight =
        queryClient.isMutating({ mutationKey: ITEM_STATE_MUTATION_KEY }) +
        queryClient.isMutating({ mutationKey: REORDER_MUTATION_KEY });
      if (inFlight > 1) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["counts"] }),
        ...plan.ids.map((id) => queryClient.invalidateQueries({ queryKey: itemQueryKey(id) })),
        ...(plan.action.type === "tag"
          ? plan.ids.map((id) => queryClient.invalidateQueries({ queryKey: itemTagsQueryKey(id) }))
          : []),
      ]);
    },
  });
  const { mutateAsync } = mutation;

  return useMemo(() => {
    async function run(
      items: readonly BoardItem[],
      ids: readonly string[],
      action: BatchAction,
      label?: string,
    ): Promise<boolean> {
      const plan = planBatch(items, ids, action);
      if (plan.ids.length === 0) return true;

      // The toast goes up with the optimistic change, like the single-item actions.
      const message = batchMessage(action, plan.ids.length, label);
      const inverse = INVERSE[action.type];
      // The inverse starts from the rows as the batch left them: they may be in no cached list.
      const after = plan.changes.map((change) => change.after);
      const toastId = inverse
        ? undoToast(message, () => void run(after, plan.ids, inverse))
        : toast(message);
      try {
        await mutateAsync({ plan });
        return true;
      } catch {
        // onError already rolled back and showed the toast.
        toast.dismiss(toastId);
        return false;
      }
    }

    return (ids, action, label) => run(findCachedItems(queryClient, ids), ids, action, label);
  }, [mutateAsync, queryClient]);
}
