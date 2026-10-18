"use client";

import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CardVariant } from "@/components/cards/types";
import { useBoardDnd } from "@/components/dnd/board-dnd-provider";
import { flatDropIndex, groupByCollection, visibleItemIds } from "@/lib/items/group";
import type { BoardItem, ItemsCursor } from "@/lib/items/queries";
import { useReorderItem } from "@/lib/items/reorder";
import { moveRow } from "@/lib/order";
import type { ViewSpec } from "@/lib/views";
import { useExpandedCollections } from "./collection-folder";
import type { DragEndEvent } from "@dnd-kit/core";

type Pages = readonly (readonly BoardItem[])[];

type SortableItemsProps = {
  view: ViewSpec;
  /** Loaded pages of items, in display order. */
  pages: Pages;
  /** Cursor of the last loaded page; non-null while more pages exist. */
  nextCursor: ItemsCursor | null;
  variant: CardVariant;
  /** All view folders: cards of closed folders are not on screen, so they are not sortable. */
  groupFolders?: boolean;
  /** Renders the cards from `pages` in the order to show (a dropped card is already in place). */
  children: (pages: Pages) => ReactNode;
};

/** A dropped order, shown until the cache catches up. Only valid while `base` is the current list. */
type DroppedOrder = { base: readonly BoardItem[]; ids: readonly string[] };

/** `pages` re-filled in `ids` order, keeping each page's length (so per-page signing still works). */
function reorderPages(pages: Pages, items: readonly BoardItem[], ids: readonly string[]): Pages {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids.map((id) => byId.get(id)).filter((item): item is BoardItem => !!item);
  let offset = 0;
  return pages.map((page) => {
    const slice = ordered.slice(offset, offset + page.length);
    offset += page.length;
    return slice;
  });
}

/**
 * Drag-to-reorder for the grid and list in manual sort. The DndContext, sensors and overlay live
 * in `BoardDndProvider` (shared with the sidebar); this registers what a drop on a card does.
 */
export function SortableItems({
  view,
  pages,
  nextCursor,
  variant,
  groupFolders,
  children,
}: SortableItemsProps) {
  const items = useMemo(() => pages.flat(), [pages]);
  const reorder = useReorderItem();
  const dnd = useBoardDnd();
  const registerReorder = dnd?.registerReorder;

  // The cache update lands a few ticks after the drop (and after a network read when the card goes
  // past the loaded rows). Showing the dropped order in the same commit that ends the drag keeps
  // bystanders from snapping back to their old slots (research-notes, Phase 5 pattern).
  const [dropped, setDropped] = useState<DroppedOrder | null>(null);
  const shownPages = useMemo(
    () => (dropped && dropped.base === items ? reorderPages(pages, items, dropped.ids) : pages),
    [dropped, items, pages],
  );

  // Indices and ids follow what is on screen, so a second drop before the cache catches up still
  // lands where the user put it.
  const shownItems = useMemo(() => shownPages.flat(), [shownPages]);
  const ids = useMemo(() => shownItems.map((item) => item.id), [shownItems]);

  // What the sortable strategy sees: the cards on screen, in screen order.
  const expanded = useExpandedCollections();
  const contextIds = useMemo(
    () => (groupFolders ? visibleItemIds(groupByCollection(shownItems, expanded)) : ids),
    [groupFolders, shownItems, expanded, ids],
  );

  const onDrop = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const fromIndex = ids.indexOf(String(active.id));
      // With folders the screen order differs from the flat order: translate the drop.
      const toIndex = groupFolders
        ? flatDropIndex(shownItems, expanded, String(active.id), String(over.id))
        : ids.indexOf(String(over.id));
      if (fromIndex === -1 || toIndex === null || toIndex === -1) return;
      const order: DroppedOrder = { base: items, ids: moveRow(ids, fromIndex, toIndex) };
      setDropped(order);
      void reorder({
        view,
        items: shownItems,
        nextCursor,
        movedId: String(active.id),
        toIndex,
      }).finally(() => setDropped((current) => (current === order ? null : current)));
    },
    [ids, items, nextCursor, reorder, shownItems, view, groupFolders, expanded],
  );
  useEffect(() => registerReorder?.(onDrop), [registerReorder, onDrop]);

  return (
    <SortableContext
      items={contextIds}
      strategy={variant === "list" ? verticalListSortingStrategy : rectSortingStrategy}
    >
      {children(shownPages)}
    </SortableContext>
  );
}
