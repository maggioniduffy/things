"use client";

import type { BoardItem } from "@/lib/items/queries";
import { BoardCard, type CardDnd } from "./board-cards";

type ItemListProps = {
  /** Loaded pages of items, in order. */
  pages: readonly (readonly BoardItem[])[];
  onRetry?: (item: BoardItem) => void | Promise<void>;
  onOpen?: (item: BoardItem) => void;
  /** Drag mode of the rows; "sortable" needs a `SortableItems` around the list. */
  dnd?: CardDnd;
};

/** The row list of a board. Rows have no thumbnails, so nothing is signed here. */
export function ItemList({ pages, onRetry, onOpen, dnd }: ItemListProps) {
  return (
    <ul className="border-line mx-4 border-t sm:mx-6" data-view-mode="list">
      {pages.flat().map((item) => (
        <BoardCard
          key={item.id}
          dnd={dnd}
          item={item}
          variant="list"
          onRetry={onRetry}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
