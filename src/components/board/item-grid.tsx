"use client";

import { useMemo } from "react";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import { groupByCollection, type GroupEntry } from "@/lib/items/group";
import type { BoardItem } from "@/lib/items/queries";
import { BoardCard, type CardDnd } from "./board-cards";
import { CollectionFolder, useExpandedCollections } from "./collection-folder";

type ItemGridProps = {
  /** Loaded pages of items, in order. */
  pages: readonly (readonly BoardItem[])[];
  onRetry?: (item: BoardItem) => void | Promise<void>;
  onOpen?: (item: BoardItem) => void;
  /** Drag mode of the cards; "sortable" needs a `SortableItems` around the grid. */
  dnd?: CardDnd;
  /** All view: cards of one collection show together as a folder (closed by default). */
  groupFolders?: boolean;
};

/**
 * One loaded page of cards. Thumbnails are signed per page, so loading another page or adding a
 * card never re-signs (and re-downloads) the thumbnails of pages that did not change.
 */
function GridPage({
  items,
  onRetry,
  onOpen,
  dnd,
}: {
  items: readonly BoardItem[];
  onRetry: ItemGridProps["onRetry"];
  onOpen: ItemGridProps["onOpen"];
  dnd: CardDnd | undefined;
}) {
  const signedUrls = useSignedUrls(items.map((item) => item.thumbnail_path));
  return (
    <>
      {items.map((item) => (
        <BoardCard
          dnd={dnd}
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

/** Consecutive loose entries of one page, so each run signs its own thumbnails. */
type Chunk =
  | { type: "run"; key: string; items: BoardItem[] }
  | { type: "folder"; entry: Extract<GroupEntry, { type: "folder" }> };

function toChunks(entries: readonly GroupEntry[], pageOf: ReadonlyMap<string, number>): Chunk[] {
  const chunks: Chunk[] = [];
  const runsPerPage = new Map<number, number>();
  let lastPage = -1;
  for (const entry of entries) {
    if (entry.type === "folder") {
      chunks.push({ type: "folder", entry });
      continue;
    }
    const page = pageOf.get(entry.item.id) ?? 0;
    const previous = chunks[chunks.length - 1];
    if (previous?.type === "run" && lastPage === page) {
      previous.items.push(entry.item);
    } else {
      const position = runsPerPage.get(page) ?? 0;
      runsPerPage.set(page, position + 1);
      chunks.push({ type: "run", key: `${page}:${position}`, items: [entry.item] });
    }
    lastPage = page;
  }
  return chunks;
}

function GroupedGrid({ pages, onRetry, onOpen, dnd }: Omit<ItemGridProps, "groupFolders">) {
  const expanded = useExpandedCollections();
  const chunks = useMemo(() => {
    const pageOf = new Map<string, number>();
    pages.forEach((items, index) => items.forEach((item) => pageOf.set(item.id, index)));
    return toChunks(groupByCollection(pages.flat(), expanded), pageOf);
  }, [pages, expanded]);
  return (
    <>
      {chunks.map((chunk) =>
        chunk.type === "run" ? (
          <GridPage
            key={`run:${chunk.key}`}
            items={chunk.items}
            onRetry={onRetry}
            onOpen={onOpen}
            dnd={dnd}
          />
        ) : (
          <CollectionFolder
            key={`folder:${chunk.entry.collectionId}`}
            collectionId={chunk.entry.collectionId}
            items={chunk.entry.items}
            expanded={chunk.entry.expanded}
            onRetry={onRetry}
            onOpen={onOpen}
            dnd={dnd}
          />
        ),
      )}
    </>
  );
}

/** The card grid of a board. */
export function ItemGrid({ pages, onRetry, onOpen, dnd, groupFolders }: ItemGridProps) {
  return (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 px-4 sm:px-6"
      data-view-mode="grid"
    >
      {groupFolders ? (
        <GroupedGrid pages={pages} onRetry={onRetry} onOpen={onOpen} dnd={dnd} />
      ) : (
        pages.map((items, index) => (
          <GridPage key={index} items={items} onRetry={onRetry} onOpen={onOpen} dnd={dnd} />
        ))
      )}
    </ul>
  );
}
