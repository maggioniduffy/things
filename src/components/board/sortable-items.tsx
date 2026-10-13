"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { CardChromeContext } from "@/components/cards/card-shell";
import { ItemCard } from "@/components/cards/item-card";
import type { CardVariant } from "@/components/cards/types";
import { focusRing } from "@/components/ui/focus-ring";
import type { BoardItem, ItemsCursor } from "@/lib/items/queries";
import { useReorderItem } from "@/lib/items/reorder";
import { moveRow } from "@/lib/order";
import type { ViewSpec } from "@/lib/views";
import { cn } from "@/lib/utils";

const SCREEN_READER_INSTRUCTIONS =
  "To reorder, press space or enter on the handle, use the arrow keys to move, then space or enter to drop. Press escape to cancel.";

type SortableUi = {
  /** A drag is active anywhere on the board: Motion layout must be off. */
  dragging: boolean;
  /** True just after a drag ended, so the click that follows it does not open the drawer. */
  wasJustDragged: () => boolean;
};

const SortableUiContext = createContext<SortableUi | null>(null);

function titleOf(items: readonly BoardItem[], id: unknown): string {
  const item = items.find((candidate) => candidate.id === id);
  return item ? itemDisplayTitle(item).replace(/\s+/g, " ") : "Item";
}

function makeAnnouncements(items: readonly BoardItem[]): Announcements {
  const total = items.length;
  const place = (id: unknown) => items.findIndex((item) => item.id === id) + 1;
  return {
    onDragStart: ({ active }) => `Picked up ${titleOf(items, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(items, active.id)} moved to position ${place(over.id)} of ${total}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(items, active.id)} dropped at position ${place(over.id)} of ${total}.`
        : `${titleOf(items, active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(items, active.id)} was cancelled.`,
  };
}

type SortableCardProps = {
  item: BoardItem;
  variant: CardVariant;
  thumbnailUrl?: string | null;
  onOpen?: (item: BoardItem) => void;
  onRetry?: (item: BoardItem) => void | Promise<void>;
};

/**
 * One draggable card. The outer `motion.li` owns Motion layout; the inner element owns the dnd-kit
 * node and transform, so the two libraries never write `transform` on the same element.
 */
export const SortableCard = memo(function SortableCard({
  item,
  variant,
  thumbnailUrl,
  onOpen,
  onRetry,
}: SortableCardProps) {
  const ui = useContext(SortableUiContext);
  const reduced = useReducedMotion() ?? false;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { thumbnailUrl } });

  const layout = ui?.dragging || reduced ? false : "position";
  const wasJustDragged = ui?.wasJustDragged;
  const open = useCallback(
    (target: BoardItem) => {
      if (wasJustDragged?.()) return;
      onOpen?.(target);
    },
    [wasJustDragged, onOpen],
  );

  const label = `Reorder ${itemDisplayTitle(item).replace(/\s+/g, " ")}`;
  const chrome = {
    as: "div" as const,
    dragHandle: (
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        aria-label={label}
        className={cn(
          "text-ink-muted hover:bg-accent hover:text-ink rounded-control relative z-20 flex size-6 shrink-0 cursor-grab items-center justify-center",
          "opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 focus-visible:opacity-100",
          variant === "grid" && "bg-surface absolute top-1.5 right-1.5",
          focusRing,
        )}
      >
        <GripVerticalIcon aria-hidden="true" className="size-4" />
      </button>
    ),
  };

  return (
    <motion.li layout={layout} className="list-none">
      <div
        ref={setNodeRef}
        {...listeners}
        data-sortable-id={item.id}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: reduced ? undefined : transition,
          opacity: isDragging ? 0.4 : 1,
        }}
        className="h-full [&>*]:h-full"
      >
        <CardChromeContext.Provider value={chrome}>
          <ItemCard
            item={item}
            variant={variant}
            thumbnailUrl={thumbnailUrl}
            onOpen={open}
            onRetry={onRetry}
          />
        </CardChromeContext.Provider>
      </div>
    </motion.li>
  );
});

const OVERLAY_CHROME = { as: "div" as const };

type Pages = readonly (readonly BoardItem[])[];

type SortableItemsProps = {
  view: ViewSpec;
  /** Loaded pages of items, in display order. */
  pages: Pages;
  /** Cursor of the last loaded page; non-null while more pages exist. */
  nextCursor: ItemsCursor | null;
  variant: CardVariant;
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

/** Drag-to-reorder for the grid and list in manual sort. */
export function SortableItems({ view, pages, nextCursor, variant, children }: SortableItemsProps) {
  const items = useMemo(() => pages.flat(), [pages]);
  const reorder = useReorderItem();
  const reduced = useReducedMotion() ?? false;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeThumb, setActiveThumb] = useState<string | null>(null);
  const justDragged = useRef(false);
  const wasJustDragged = useCallback(() => justDragged.current, []);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );
  // The cache update lands a few ticks after the drop (and after a network read when the card goes
  // past the loaded rows). Showing the dropped order in the same commit that ends the drag keeps
  // bystanders from snapping back to their old slots (research-notes, Phase 5 pattern).
  const [dropped, setDropped] = useState<DroppedOrder | null>(null);
  const shownPages = useMemo(
    () => (dropped && dropped.base === items ? reorderPages(pages, items, dropped.ids) : pages),
    [dropped, items, pages],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Indices and ids follow what is on screen, so a second drop before the cache catches up still
  // lands where the user put it.
  const shownItems = useMemo(() => shownPages.flat(), [shownPages]);
  const ids = useMemo(() => shownItems.map((item) => item.id), [shownItems]);
  const announcements = useMemo(() => makeAnnouncements(items), [items]);
  const ui = useMemo<SortableUi>(
    () => ({ dragging: activeId !== null, wasJustDragged }),
    [activeId, wasJustDragged],
  );

  function finish() {
    setActiveId(null);
    justDragged.current = true;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      justDragged.current = false;
    }, 150);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    const thumb = event.active.data.current?.thumbnailUrl;
    setActiveThumb(typeof thumb === "string" ? thumb : null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    finish();
    if (!over || active.id === over.id) return;
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    const order: DroppedOrder = { base: items, ids: moveRow(ids, fromIndex, toIndex) };
    setDropped(order);
    void reorder({
      view,
      items: shownItems,
      nextCursor,
      movedId: String(active.id),
      toIndex,
    }).finally(() => setDropped((current) => (current === order ? null : current)));
  }

  const active = activeId ? items.find((item) => item.id === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: SCREEN_READER_INSTRUCTIONS },
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
      <SortableUiContext.Provider value={ui}>
        <SortableContext
          items={ids}
          strategy={variant === "list" ? verticalListSortingStrategy : rectSortingStrategy}
        >
          {children(shownPages)}
        </SortableContext>
      </SortableUiContext.Provider>
      <DragOverlay dropAnimation={reduced ? null : { duration: 150, easing: "ease-out" }}>
        {active ? (
          <div className="shadow-card-hover rounded-card h-full cursor-grabbing [&>*]:h-full">
            <CardChromeContext.Provider value={OVERLAY_CHROME}>
              <ItemCard item={active} variant={variant} thumbnailUrl={activeThumb} />
            </CardChromeContext.Provider>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
