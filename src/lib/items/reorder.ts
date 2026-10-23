"use client";

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { getActiveMessages } from "@/i18n/active";
import { needsUnloadedPosition, planMove, type PositionUpdate } from "@/lib/order";
import { createClient } from "@/lib/supabase/client";
import type { SortMode, ViewSpec } from "@/lib/views";
import { insertSortedInPages, patchInPages, removeFromPages } from "./cache";
import { itemQueryKey } from "./item-query";
import { ITEM_STATE_MUTATION_KEY, REORDER_MUTATION_KEY } from "./mutation-keys";
import { fetchItemsPage, type BoardItem, type ItemsCursor, type ItemsPage } from "./queries";

type Items = InfiniteData<ItemsPage>;

type Snapshot = {
  lists: [QueryKey, Items | undefined][];
  details: [string, BoardItem | null | undefined][];
};

function isSortMode(value: unknown): value is SortMode {
  return value === "manual" || value === "newest" || value === "oldest" || value === "title";
}

/**
 * `data` with the new positions applied. Manual-sort lists re-place the rows (an item dropped
 * after the last loaded row stays at the end of the loaded part); other sorts only patch.
 */
export function applyPositions(
  data: Items,
  updates: readonly PositionUpdate[],
  sort: SortMode,
): Items {
  if (sort !== "manual") {
    return updates.reduce((acc, u) => patchInPages(acc, u.id, { position: u.position }), data);
  }
  const moved: BoardItem[] = [];
  let next = data;
  for (const update of updates) {
    for (const page of next.pages) {
      const found = page.items.find((item) => item.id === update.id);
      if (found) moved.push({ ...found, position: update.position });
    }
    next = removeFromPages(next, update.id);
  }
  for (const item of moved) {
    const inserted = insertSortedInPages(next, item, "manual");
    if (inserted !== next) {
      next = inserted;
      continue;
    }
    // Past every loaded row while more pages follow: it ends the loaded part.
    const lastIndex = next.pages.length - 1;
    next = {
      ...next,
      pages: next.pages.map((page, index) =>
        index === lastIndex ? { ...page, items: [...page.items, item] } : page,
      ),
    };
  }
  return next;
}

function applyOptimistic(queryClient: QueryClient, updates: readonly PositionUpdate[]): void {
  const ids = new Set(updates.map((u) => u.id));
  for (const [key, data] of queryClient.getQueriesData<Items>({ queryKey: ["items"] })) {
    if (!data) continue;
    const sort = key[2];
    if (!isSortMode(sort)) continue;
    if (!data.pages.some((page) => page.items.some((item) => ids.has(item.id)))) continue;
    const relevant = updates.filter((u) =>
      data.pages.some((page) => page.items.some((item) => item.id === u.id)),
    );
    queryClient.setQueryData(key, applyPositions(data, relevant, sort));
  }
  for (const update of updates) {
    queryClient.setQueryData<BoardItem | null | undefined>(itemQueryKey(update.id), (item) =>
      item ? { ...item, position: update.position } : item,
    );
  }
}

export type ReorderRequest = {
  view: ViewSpec;
  /** The view's loaded rows in display order. */
  items: readonly BoardItem[];
  /** Cursor of the last loaded page; non-null while more pages exist. */
  nextCursor: ItemsCursor | null;
  movedId: string;
  /** Index the moved row lands at. */
  toIndex: number;
};

/** Optimistic reorder: writes only `position` of the moved row (more only when keys were tied). */
export function useReorderItem(): (request: ReorderRequest) => Promise<void> {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: REORDER_MUTATION_KEY,
    mutationFn: async ({ updates }: { updates: PositionUpdate[] }) => {
      const client = createClient();
      for (const { id, position } of updates) {
        const { error } = await client.from("items").update({ position }).eq("id", id);
        if (error) throw error;
      }
    },
    onMutate: async ({ updates }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const snapshot: Snapshot = {
        lists: queryClient.getQueriesData<Items>({ queryKey: ["items"] }),
        details: updates.map((u) => [
          u.id,
          queryClient.getQueryData<BoardItem | null>(itemQueryKey(u.id)),
        ]),
      };
      applyOptimistic(queryClient, updates);
      return snapshot;
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) {
        for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
        for (const [id, detail] of snapshot.details) {
          if (detail !== undefined) queryClient.setQueryData(itemQueryKey(id), detail);
        }
      }
      toast.error(getActiveMessages().items.toasts.errMove);
    },
    onSettled: async () => {
      // Only the last of overlapping reorders refetches, or it would flash older data.
      // Item state changes refetch the same lists, so they count as overlapping too.
      const inFlight =
        queryClient.isMutating({ mutationKey: REORDER_MUTATION_KEY }) +
        queryClient.isMutating({ mutationKey: ITEM_STATE_MUTATION_KEY });
      if (inFlight > 1) return;
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
  const { mutateAsync } = mutation;

  return useMemo(
    () => async (request: ReorderRequest) => {
      const { view, items, nextCursor, movedId, toIndex } = request;
      let unloaded: string | null = null;
      if (needsUnloadedPosition(items, movedId, toIndex, nextCursor !== null)) {
        try {
          // After the last row on screen, not after the last page the server sent: an earlier
          // optimistic drop can sit past that page's cursor.
          const last = items[items.length - 1];
          const cursor = last ? { value: last.position, id: last.id } : nextCursor;
          const page = await fetchItemsPage(createClient(), view, "manual", cursor, 1);
          unloaded = page.items[0]?.position ?? null;
        } catch {
          toast.error(getActiveMessages().items.toasts.errMove);
          return;
        }
      }
      let updates: PositionUpdate[];
      try {
        updates = planMove(items, movedId, toIndex, unloaded);
      } catch {
        // fractional-indexing throws on a malformed stored key.
        toast.error(getActiveMessages().items.toasts.errMove);
        return;
      }
      if (updates.length === 0) return;
      try {
        await mutateAsync({ updates });
      } catch {
        // onError already rolled back and showed the toast.
      }
    },
    [mutateAsync],
  );
}
