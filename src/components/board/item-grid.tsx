"use client";

import { ItemCard } from "@/components/cards/item-card";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import type { BoardItem } from "@/lib/items/queries";
import { SortableCard } from "./sortable-items";

type ItemGridProps = {
  /** Loaded pages of items, in order. */
  pages: readonly (readonly BoardItem[])[];
  onRetry?: (item: BoardItem) => void | Promise<void>;
  onOpen?: (item: BoardItem) => void;
  /** Cards are draggable; render inside `SortableItems`. */
  sortable?: boolean;
};

/**
 * One loaded page of cards. Thumbnails are signed per page, so loading another page or adding a
 * card never re-signs (and re-downloads) the thumbnails of pages that did not change.
 */
function GridPage({
  items,
  onRetry,
  onOpen,
  sortable,
}: {
  items: readonly BoardItem[];
  onRetry: ItemGridProps["onRetry"];
  onOpen: ItemGridProps["onOpen"];
  sortable: boolean;
}) {
  const Card = sortable ? SortableCard : ItemCard;
  const signedUrls = useSignedUrls(items.map((item) => item.thumbnail_path));
  return (
    <>
      {items.map((item) => (
        <Card
          key={item.id}
          item={item}
          variant="grid"
          thumbnailUrl={item.thumbnail_path ? signedUrls.get(item.thumbnail_path) : null}
          onRetry={onRetry}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

/** The card grid of a board. */
export function ItemGrid({ pages, onRetry, onOpen, sortable = false }: ItemGridProps) {
  return (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 px-4 sm:px-6"
      data-view-mode="grid"
    >
      {pages.map((items, index) => (
        <GridPage key={index} items={items} onRetry={onRetry} onOpen={onOpen} sortable={sortable} />
      ))}
    </ul>
  );
}
