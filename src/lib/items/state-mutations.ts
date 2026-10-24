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
import { getActiveMessages } from "@/i18n/active";
import { undoToast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import type { Database } from "@/types/supabase";
import {
  addToCounts,
  addToTagLists,
  findCachedItem,
  insertSortedInPages,
  isSearchKey,
  isSortMode,
  viewContextOf,
  itemMatchesView,
  itemStaysInView,
  patchInPages,
  removeFromCounts,
  removeFromPages,
  viewFromKey,
} from "./cache";
import { attachTags, ensureTags } from "@/lib/tags/mutations";
import { itemQueryKey, itemTagsQueryKey } from "./item-query";
import { ITEM_STATE_MUTATION_KEY, REORDER_MUTATION_KEY } from "./mutation-keys";
import type { NoteColor } from "./note-colors";
import type { BoardItem, ItemsPage } from "./queries";
import { BUCKET, thumbnailPath } from "./upload";

type Client = SupabaseClient<Database>;
type Items = InfiniteData<ItemsPage>;

const TAG_MUTATION_KEY = ["item-tag"] as const;

/** Fields the drawer edits in place. */
export type EditableFields = Partial<Pick<BoardItem, "title" | "note" | "collection_id">> & {
  color?: NoteColor | null;
};

// ---------------------------------------------------------------------------
// The change (pure) and how it lands in the caches
// ---------------------------------------------------------------------------

/** One optimistic change to an item row: what it was, what it becomes and how to save it. */
type ItemChange = {
  before: BoardItem;
  /** The row afterwards; null when the row is deleted. */
  after: BoardItem | null;
  /** Copy for the error toast, e.g. "Couldn't move to trash." */
  errorCopy: string;
  write: (client: Client) => Promise<void>;
};

type Snapshot = {
  lists: [QueryKey, Items | undefined][];
  counts: SidebarCounts | undefined;
  detail: BoardItem | null | undefined;
};

function snapshotOf(queryClient: QueryClient, id: string): Snapshot {
  return {
    lists: queryClient.getQueriesData<Items>({ queryKey: ["items"] }),
    counts: queryClient.getQueryData<SidebarCounts>(["counts"]),
    detail: queryClient.getQueryData<BoardItem | null>(itemQueryKey(id)),
  };
}

function restore(queryClient: QueryClient, id: string, snapshot: Snapshot): void {
  for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
  queryClient.setQueryData(["counts"], snapshot.counts);
  if (snapshot.detail !== undefined) queryClient.setQueryData(itemQueryKey(id), snapshot.detail);
}

/** Applies a change to every cached list, the sidebar counts and the item's own entry. */
export function applyChange(
  queryClient: QueryClient,
  { before, after }: Pick<ItemChange, "before" | "after">,
): void {
  const context = viewContextOf(queryClient);
  for (const [key, data] of queryClient.getQueriesData<Items>({ queryKey: ["items"] })) {
    if (!data) continue;
    const [, vk, sort] = key;
    const view = typeof vk === "string" ? viewFromKey(vk) : null;
    if (!view) continue;

    let next = data;
    if (after === null || !itemStaysInView(after, view, context)) {
      next = removeFromPages(data, before.id);
    } else {
      next = patchInPages(data, before.id, after);
      // Newly matching a list it was not in (restore, unarchive, new collection).
      if (
        next === data &&
        view.type !== "tag" &&
        !isSearchKey(key) &&
        isSortMode(sort) &&
        itemMatchesView(after, view, context)
      ) {
        next = insertSortedInPages(data, after, sort);
      }
    }
    if (next !== data) queryClient.setQueryData(key, next);
  }

  queryClient.setQueryData<SidebarCounts>(["counts"], (counts) => {
    if (!counts) return counts;
    const without = removeFromCounts(counts, before);
    return after ? addToCounts(without, after) : without;
  });

  // The drawer keeps showing an item that left the current view (e.g. just marked read in Unread).
  if (queryClient.getQueryData(itemQueryKey(before.id)) !== undefined) {
    queryClient.setQueryData(itemQueryKey(before.id), after);
  }
}

// ---------------------------------------------------------------------------
// Row changes (pure)
// ---------------------------------------------------------------------------

export type StateAction = "trash" | "restore" | "archive" | "unarchive" | "favorite" | "read";

function stamp(item: BoardItem, patch: Partial<BoardItem>): BoardItem {
  return { ...item, ...patch };
}

/** The row patch of a state action, relative to `item` as it is now. */
export function statePatch(
  action: StateAction,
  item: BoardItem,
  now: string = new Date().toISOString(),
): Partial<BoardItem> {
  switch (action) {
    case "trash":
      return { deleted_at: now };
    case "restore":
      return { deleted_at: null };
    case "archive":
      return { archived_at: now };
    case "unarchive":
      return { archived_at: null };
    case "favorite":
      return { is_favorite: !item.is_favorite };
    case "read":
      return { is_read: true };
  }
}

/** Error toast copy per action, in the active language (read when the action runs). */
function errorCopy(action: StateAction): string {
  const copy = getActiveMessages().items.toasts;
  return {
    trash: copy.errTrash,
    restore: copy.errRestore,
    archive: copy.errArchive,
    unarchive: copy.errUnarchive,
    favorite: copy.errFavorite,
    read: copy.errRead,
  }[action];
}

/** Undo toast of the actions that have an inverse. */
function undoCopy(action: StateAction): { message: string; inverse: StateAction } | undefined {
  const copy = getActiveMessages().items.toasts;
  switch (action) {
    case "trash":
      return { message: copy.movedToTrash, inverse: "restore" };
    case "restore":
      return { message: copy.restored, inverse: "trash" };
    case "archive":
      return { message: copy.archived, inverse: "unarchive" };
    case "unarchive":
      return { message: copy.unarchived, inverse: "archive" };
    default:
      return undefined;
  }
}

function patchChange(before: BoardItem, patch: Partial<BoardItem>, errorCopy: string): ItemChange {
  return {
    before,
    after: stamp(before, patch),
    errorCopy,
    write: async (client) => {
      const { error } = await client.from("items").update(patch).eq("id", before.id);
      if (error) throw error;
    },
  };
}

/** Storage objects of an item: the file and its thumbnail (removing a missing object is a no-op). */
export function storagePathsOf(item: BoardItem): string[] {
  const paths = [item.file_path, item.thumbnail_path, thumbnailPath(item.user_id, item.id)];
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

function deleteChange(before: BoardItem): ItemChange {
  return {
    before,
    after: null,
    errorCopy: getActiveMessages().items.toasts.errDelete,
    write: async (client) => {
      // Objects first: if this fails the row stays and the delete can be retried, with no orphans.
      const removed = await client.storage.from(BUCKET).remove(storagePathsOf(before));
      if (removed.error) throw removed.error;
      const { error } = await client.from("items").delete().eq("id", before.id);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export type ItemActions = {
  /** Marks an unread item as read; does nothing for a read one. */
  markRead(item: BoardItem): Promise<void>;
  toggleFavorite(item: BoardItem): Promise<void>;
  /** Archive, unarchive, trash and restore show an Undo toast that runs the inverse. */
  archive(item: BoardItem): Promise<void>;
  unarchive(item: BoardItem): Promise<void>;
  trash(item: BoardItem): Promise<void>;
  restore(item: BoardItem): Promise<void>;
  /** Removes the storage objects, then the row. Not undoable. */
  deleteForever(item: BoardItem): Promise<void>;
  /** Saves title, note text or collection. */
  edit(item: BoardItem, fields: EditableFields): Promise<void>;
};

/** Optimistic item state mutations: apply to every cache at once, roll back on error. */
export function useItemActions(): ItemActions {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ITEM_STATE_MUTATION_KEY,
    mutationFn: ({ change }: { change: ItemChange }) => change.write(createClient()),
    onMutate: async ({ change }) => {
      // A fetch that started before this change would overwrite it with older data.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["items"] }),
        queryClient.cancelQueries({ queryKey: ["counts"] }),
        queryClient.cancelQueries({ queryKey: itemQueryKey(change.before.id) }),
      ]);
      const snapshot = snapshotOf(queryClient, change.before.id);
      applyChange(queryClient, change);
      return snapshot;
    },
    onError: (_error, { change }, snapshot) => {
      if (snapshot) restore(queryClient, change.before.id, snapshot);
      toast.error(change.errorCopy);
    },
    onSettled: async (_data, _error, { change }) => {
      // Several changes can overlap: only the last one to settle refetches, or an early refetch
      // would flash older data over a later optimistic edit.
      // Reorders refetch the same lists, so they count as overlapping too.
      const inFlight =
        queryClient.isMutating({ mutationKey: ITEM_STATE_MUTATION_KEY }) +
        queryClient.isMutating({ mutationKey: REORDER_MUTATION_KEY });
      if (inFlight > 1) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["counts"] }),
        queryClient.invalidateQueries({ queryKey: itemQueryKey(change.before.id) }),
      ]);
    },
  });
  const { mutateAsync } = mutation;

  return useMemo(() => {
    async function run(change: ItemChange): Promise<boolean> {
      try {
        await mutateAsync({ change });
        return true;
      } catch {
        // onError already rolled back and showed the toast.
        return false;
      }
    }

    async function apply(action: StateAction, item: BoardItem): Promise<void> {
      const patch = statePatch(action, item);
      const change = patchChange(item, patch, errorCopy(action));
      const undo = undoCopy(action);
      if (!undo) {
        await run(change);
        return;
      }
      // The toast goes up with the optimistic change; the inverse starts from the new row.
      const toastId = undoToast(undo.message, () => void apply(undo.inverse, change.after ?? item));
      if (!(await run(change))) toast.dismiss(toastId);
    }

    return {
      markRead: async (item) => {
        if (item.is_read) return;
        await apply("read", item);
      },
      toggleFavorite: (item) => apply("favorite", item),
      archive: (item) => apply("archive", item),
      unarchive: (item) => apply("unarchive", item),
      trash: (item) => apply("trash", item),
      restore: (item) => apply("restore", item),
      deleteForever: async (item) => {
        await run(deleteChange(item));
      },
      edit: async (item, fields) => {
        await run(patchChange(item, fields, getActiveMessages().items.toasts.errSave));
      },
    };
  }, [mutateAsync]);
}

// ---------------------------------------------------------------------------
// Tags (attach / detach existing tags)
// ---------------------------------------------------------------------------

type TagChange = { itemId: string; tagIds: string[]; attach: boolean };

export type TagActions = {
  addTag(itemId: string, tagId: string): Promise<void>;
  removeTag(itemId: string, tagId: string): Promise<void>;
  /**
   * Attaches tags by name (e.g. from inline `#tags`): creates the missing ones in one insert,
   * reuses existing ones ignoring case, then attaches all of them in one insert.
   */
  addTagsByName(itemId: string, names: readonly string[]): Promise<void>;
};

/** Optimistic attach/detach of tags on an item (`item_tags` rows). */
export function useTagActions(): TagActions {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: TAG_MUTATION_KEY,
    mutationFn: async ({ itemId, tagIds, attach }: TagChange) => {
      const client = createClient();
      if (attach) {
        await attachTags(client, itemId, tagIds);
      } else {
        const { error } = await client
          .from("item_tags")
          .delete()
          .eq("item_id", itemId)
          .in("tag_id", tagIds);
        if (error) throw error;
      }
    },
    onMutate: async ({ itemId, tagIds, attach }) => {
      const key = itemTagsQueryKey(itemId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: key }),
        queryClient.cancelQueries({ queryKey: ["items"] }),
      ]);
      const tags = queryClient.getQueryData<string[]>(key);
      const lists = queryClient.getQueriesData<Items>({ queryKey: ["items"] });
      const cached = attach ? findCachedItem(queryClient, itemId) : null;

      queryClient.setQueryData<string[]>(key, (current) => {
        const ids = current ?? [];
        return attach
          ? [...ids, ...tagIds.filter((tagId) => !ids.includes(tagId))]
          : ids.filter((id) => !tagIds.includes(id));
      });
      // The item joins those tags' own views at once.
      if (cached) addToTagLists(queryClient, cached, tagIds);
      if (!attach) {
        // The item leaves those tags' own views at once.
        for (const [listKey, data] of lists) {
          if (!data || !tagIds.some((tagId) => listKey[1] === `tag:${tagId}`)) continue;
          queryClient.setQueryData(listKey, removeFromPages(data, itemId));
        }
      }
      return { tags, lists };
    },
    onError: (_error, { itemId, attach }, context) => {
      if (context) {
        queryClient.setQueryData(itemTagsQueryKey(itemId), context.tags);
        for (const [key, data] of context.lists) queryClient.setQueryData(key, data);
      }
      const copy = getActiveMessages().items.toasts;
      toast.error(attach ? copy.errAddTag : copy.errRemoveTag);
    },
    onSettled: async (_data, _error, { itemId }) => {
      if (queryClient.isMutating({ mutationKey: TAG_MUTATION_KEY }) > 1) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: itemTagsQueryKey(itemId) }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
      ]);
    },
  });
  const { mutateAsync } = mutation;

  return useMemo(() => {
    const run = async (change: TagChange) => {
      try {
        await mutateAsync(change);
      } catch {
        // onError already rolled back and showed the toast.
      }
    };
    return {
      addTag: (itemId, tagId) => run({ itemId, tagIds: [tagId], attach: true }),
      removeTag: (itemId, tagId) => run({ itemId, tagIds: [tagId], attach: false }),
      addTagsByName: async (itemId, names) => {
        if (names.length === 0) return;
        let tags;
        try {
          tags = await ensureTags(createClient(), queryClient, names);
        } catch {
          toast.error(getActiveMessages().items.toasts.errAddTags);
          return;
        }
        await run({ itemId, tagIds: tags.map((tag) => tag.id), attach: true });
      },
    };
  }, [mutateAsync, queryClient]);
}
