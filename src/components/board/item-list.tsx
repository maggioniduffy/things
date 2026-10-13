"use client";

import { ItemCard } from "@/components/cards/item-card";
import type { BoardItem } from "@/lib/items/queries";

type ItemListProps = {
  /** Loaded pages of items, in order. */
  pages: readonly (readonly BoardItem[])[];
  onRetry?: (item: BoardItem) => void | Promise<void>;
  onOpen?: (item: BoardItem) => void;
};

/** The row list of a board. Rows have no thumbnails, so nothing is signed here. */
export function ItemList({ pages, onRetry, onOpen }: ItemListProps) {
  return (
    <ul className="border-line mx-4 border-t sm:mx-6" data-view-mode="list">
      {pages.flat().map((item) => (
        <ItemCard key={item.id} item={item} variant="list" onRetry={onRetry} onOpen={onOpen} />
      ))}
    </ul>
  );
}
