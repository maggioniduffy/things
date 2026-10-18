import type { BoardItem } from "@/lib/items/queries";
import { moveRow } from "@/lib/order";

/** One slot of the All grid: a loose card, or every loaded card of one collection. */
export type GroupEntry =
  | { type: "item"; item: BoardItem }
  | { type: "folder"; collectionId: string; items: BoardItem[]; expanded: boolean };

/**
 * Groups items by collection, keeping the current sort. A folder sits where its first item falls;
 * its other items are pulled up to it (in their own order). Items without a collection stay loose,
 * and a collection with a single loaded item still forms a folder. `items` is every loaded page.
 */
export function groupByCollection(
  items: readonly BoardItem[],
  expanded: ReadonlySet<string>,
): GroupEntry[] {
  const entries: GroupEntry[] = [];
  const folders = new Map<string, Extract<GroupEntry, { type: "folder" }>>();
  for (const item of items) {
    const collectionId = item.collection_id;
    if (!collectionId) {
      entries.push({ type: "item", item });
      continue;
    }
    const existing = folders.get(collectionId);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    const folder = {
      type: "folder" as const,
      collectionId,
      items: [item],
      expanded: expanded.has(collectionId),
    };
    folders.set(collectionId, folder);
    entries.push(folder);
  }
  return entries;
}

/** Ids of the cards on screen, in display order: loose cards and the cards of open folders. */
export function visibleItemIds(entries: readonly GroupEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.type === "item"
      ? [entry.item.id]
      : entry.expanded
        ? entry.items.map((item) => item.id)
        : [],
  );
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Where a drop lands in the flat order, when the screen shows the grouped order.
 * `flat` is the sort order; the user dragged `activeId` onto `overId`, both on screen. Returns the
 * flat index to move the card to, or null for a drop that must not write anything.
 *
 * It looks for the flat target whose grouped result is exactly what the user saw. For a card moved
 * inside its own open folder that always exists except when the card jumps over loose cards that
 * sit between folder cards in the flat order; then the nearest target that gives the right order
 * inside the folder is used and the folder may shift as a whole. A folder card dropped outside its
 * folder, a loose card dropped inside a folder, and drops that change nothing on screen are null.
 */
export function flatDropIndex(
  flat: readonly BoardItem[],
  expanded: ReadonlySet<string>,
  activeId: string,
  overId: string,
): number | null {
  const visible = visibleItemIds(groupByCollection(flat, expanded));
  const vFrom = visible.indexOf(activeId);
  const vTo = visible.indexOf(overId);
  if (vFrom === -1 || vTo === -1 || vFrom === vTo) return null;
  const desired = moveRow(visible, vFrom, vTo);

  const flatIds = flat.map((item) => item.id);
  const from = flatIds.indexOf(activeId);
  if (from === -1) return null;
  const visibleAfter = (target: number) =>
    visibleItemIds(groupByCollection(moveRow(flat, from, target), expanded));

  for (let target = 0; target < flat.length; target++) {
    if (target !== from && sameOrder(visibleAfter(target), desired)) return target;
  }

  // No exact match: accept a reorder inside one folder, with the folder free to shift.
  const active = flat[from];
  const over = flat.find((item) => item.id === overId);
  const collectionId = active?.collection_id;
  if (!collectionId || over?.collection_id !== collectionId) return null;
  const inFolder = new Set(flat.filter((i) => i.collection_id === collectionId).map((i) => i.id));
  const wanted = desired.filter((id) => inFolder.has(id));
  for (let target = 0; target < flat.length; target++) {
    if (target === from) continue;
    const got = visibleAfter(target).filter((id) => inFolder.has(id));
    if (sameOrder(got, wanted)) return target;
  }
  return null;
}
