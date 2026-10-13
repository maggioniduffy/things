import { closestCenter, pointerWithin, type CollisionDetection } from "@dnd-kit/core";
import { isSidebarDropData } from "./targets";

/** Marks the sidebar's root element: a drop there that misses every target is not a reorder. */
export const SIDEBAR_ZONE_ATTRIBUTE = "data-dnd-sidebar";

function overSidebar(x: number, y: number): boolean {
  if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") {
    return false;
  }
  // The drag overlay sits under the pointer, so look through the whole stack.
  return document
    .elementsFromPoint(x, y)
    .some((element) => element.closest(`[${SIDEBAR_ZONE_ATTRIBUTE}]`) !== null);
}

/**
 * Sidebar targets win when the pointer is on one (or, with the keyboard, when the moved card's
 * corner lands on one); otherwise cards compete by center distance, as in WP 5.2. A pointer over
 * the sidebar but off every target matches nothing, so the drop cannot reorder a card.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const targets = args.droppableContainers.filter((container) =>
    isSidebarDropData(container.data.current),
  );
  const cards = args.droppableContainers.filter(
    (container) => !isSidebarDropData(container.data.current),
  );

  if (args.pointerCoordinates) {
    const { x, y } = args.pointerCoordinates;
    const hits = pointerWithin({ ...args, droppableContainers: targets });
    if (hits.length > 0) return hits;
    if (overSidebar(x, y)) return [];
  } else if (args.collisionRect) {
    // Keyboard: the sortable coordinate getter puts the card's top-left on the chosen droppable.
    const x = args.collisionRect.left + 1;
    const y = args.collisionRect.top + 1;
    for (const container of targets) {
      const rect = args.droppableRects.get(container.id);
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
      }
    }
  }

  return closestCenter({ ...args, droppableContainers: cards });
};
