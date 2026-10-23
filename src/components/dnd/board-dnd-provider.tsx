"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useReducedMotion } from "motion/react";
import {
  createContext,
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
import { getActiveMessages } from "@/i18n/active";
import { useBatchMove } from "@/lib/items/batch-mutations";
import type { BoardItem } from "@/lib/items/queries";
import { useUiStore } from "@/stores/ui-store";
import { boardCollisionDetection } from "./collision";
import {
  isSidebarDropData,
  isSidebarSortData,
  type SidebarSortData,
  type SidebarSortSection,
} from "./targets";

/** `data` every draggable card registers, so the overlay and announcements can describe it. */
export type CardDragData = {
  item: BoardItem;
  variant: CardVariant;
  thumbnailUrl?: string | null;
};

function isCardDragData(value: unknown): value is CardDragData {
  return typeof value === "object" && value !== null && "item" in value && "variant" in value;
}

/** Called with the drop of a card on another card (reorder). Registered by `SortableItems`. */
export type ReorderHandler = (event: DragEndEvent) => void;

/** Called with the drop of a sidebar row on a row of its section. Registered by `SortableRows`. */
export type RowReorderHandler = (event: DragEndEvent) => void;

type BoardDnd = {
  /** A drag is active anywhere (a card or a sidebar row): Motion layout must be off. */
  dragging: boolean;
  /** The section whose row is being reordered; null when no sidebar row is dragged. */
  sortingSection: SidebarSortSection | null;
  /** Ids that travel with the drag (the card, or the whole selection); null when idle. */
  draggingIds: ReadonlySet<string> | null;
  /** True just after a drag ended, so the click that follows it does not open the drawer. */
  wasJustDragged: () => boolean;
  /** Synchronous: true from drag start until the drag ends or is cancelled. */
  isDragActive: () => boolean;
  /** Sets who handles drops on cards. Returns a function that unregisters it. */
  registerReorder: (handler: ReorderHandler) => () => void;
  /** Sets who handles a sidebar row dropped in `section`. Returns a function that unregisters it. */
  registerRowReorder: (section: SidebarSortSection, handler: RowReorderHandler) => () => void;
};

const BoardDndContext = createContext<BoardDnd | null>(null);

/** The shared drag state; null outside a `BoardDndProvider` (e.g. in isolated tests). */
export function useBoardDnd(): BoardDnd | null {
  return useContext(BoardDndContext);
}

type ActiveDrag = { id: string; data: CardDragData; ids: readonly string[] };

const OVERLAY_CHROME = { as: "div" as const };

function plural(count: number): string {
  return getActiveMessages().shell.itemCount(count);
}

/** The card under the pointer; a stack with a count badge when it carries a selection. */
function DragPreview({ drag }: { drag: ActiveDrag }) {
  const count = drag.ids.length;
  return (
    <div className="relative isolate h-full cursor-grabbing">
      {count > 1 ? (
        <>
          <div
            aria-hidden="true"
            className="rounded-card border-line bg-surface shadow-card absolute inset-0 -z-20 translate-x-3 translate-y-3 border"
          />
          <div
            aria-hidden="true"
            className="rounded-card border-line bg-surface shadow-card absolute inset-0 -z-10 translate-x-1.5 translate-y-1.5 border"
          />
        </>
      ) : null}
      <div className="shadow-card-hover rounded-card h-full [&>*]:h-full">
        <CardChromeContext.Provider value={OVERLAY_CHROME}>
          <ItemCard
            item={drag.data.item}
            variant={drag.data.variant}
            thumbnailUrl={drag.data.thumbnailUrl}
          />
        </CardChromeContext.Provider>
      </div>
      {count > 1 ? (
        <span
          data-slot="drag-count"
          className="bg-ink text-primary-foreground text-meta absolute -top-2 -right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-medium tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One DndContext for the board and the sidebar, so a card can be dropped on a sidebar target.
 * Dropping on a card reorders (handled by `SortableItems`); dropping on a sidebar row runs one
 * batch mutation for the card, or for the whole selection when the card is part of it.
 */
export function BoardDndProvider({ children }: { children: ReactNode }) {
  const move = useBatchMove();
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [overTarget, setOverTarget] = useState(false);
  const activeRef = useRef<ActiveDrag | null>(null);
  const reorderRef = useRef<ReorderHandler | null>(null);
  // The sidebar renders twice (desktop and the mobile sheet), so a section can have two handlers;
  // the newest one runs, and unmounting one copy leaves the other registered.
  const rowReorderRef = useRef<Partial<Record<SidebarSortSection, RowReorderHandler[]>>>({});
  const [sortingSection, setSortingSection] = useState<SidebarSortSection | null>(null);
  const justDragged = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const wasJustDragged = useCallback(() => justDragged.current, []);
  const isDragActive = useCallback(() => activeRef.current !== null, []);
  const registerReorder = useCallback((handler: ReorderHandler) => {
    reorderRef.current = handler;
    return () => {
      if (reorderRef.current === handler) reorderRef.current = null;
    };
  }, []);

  const registerRowReorder = useCallback(
    (section: SidebarSortSection, handler: RowReorderHandler) => {
      const handlers = rowReorderRef.current;
      handlers[section] = [...(handlers[section] ?? []), handler];
      return () => {
        handlers[section] = (handlers[section] ?? []).filter((current) => current !== handler);
      };
    },
    [],
  );

  function finish() {
    activeRef.current = null;
    setActive(null);
    setSortingSection(null);
    setOverTarget(false);
    justDragged.current = true;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      justDragged.current = false;
    }, 150);
  }

  function onDragStart({ active: dragged }: DragStartEvent) {
    const data = dragged.data.current;
    if (isSidebarSortData(data)) {
      setSortingSection(data.section);
      return;
    }
    if (!isCardDragData(data)) return;
    const id = String(dragged.id);
    // A card in the selection carries the whole selection; any other card goes alone.
    const selected = useUiStore.getState().selectedIds;
    const next: ActiveDrag = {
      id,
      data,
      ids: selected.includes(id) && selected.length > 1 ? selected : [id],
    };
    activeRef.current = next;
    setActive(next);
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverTarget(isSidebarDropData(over?.data.current));
  }

  function onDragEnd(event: DragEndEvent) {
    const drag = activeRef.current;
    finish();
    const { over } = event;

    const sorted: SidebarSortData | null = isSidebarSortData(event.active.data.current)
      ? event.active.data.current
      : null;
    if (sorted) {
      const overData = over?.data.current;
      if (isSidebarSortData(overData) && overData.section === sorted.section) {
        rowReorderRef.current[sorted.section]?.at(-1)?.(event);
      }
      return;
    }

    if (!drag || !over) return;

    const target = over.data.current;
    if (isSidebarDropData(target)) {
      void move(drag.ids, target.action, target.label);
      useUiStore.getState().clearSelection();
      return;
    }
    // Reordering a multi-selection is not supported: only a lone card can be dropped on a card.
    if (drag.ids.length > 1) return;
    reorderRef.current?.(event);
  }

  const announcements = useMemo<Announcements>(() => {
    // Read per announcement, so a language switch applies without remounting the provider.
    const t = () => getActiveMessages().shell.dnd;
    const subject = (data: unknown, id: unknown): string => {
      const count = activeRef.current?.ids.length ?? 1;
      if (count > 1) return plural(count);
      if (isSidebarSortData(data)) return data.label;
      return isCardDragData(data) ? itemDisplayTitle(data.item).replace(/\s+/g, " ") : String(id);
    };
    const place = (over: DragOverEvent["over"]): string | null => {
      const sortable = (over?.data.current as { sortable?: { index: number; items: unknown[] } })
        ?.sortable;
      return sortable ? t().position(sortable.index + 1, sortable.items.length) : null;
    };
    return {
      onDragStart: ({ active: dragged }) => {
        const count = useUiStore.getState().selectedIds.includes(String(dragged.id))
          ? useUiStore.getState().selectedIds.length
          : 1;
        const what = count > 1 ? plural(count) : subject(dragged.data.current, dragged.id);
        return t().pickedUp(what);
      },
      onDragOver: ({ active: dragged, over }) => {
        if (!over) return undefined;
        const what = subject(dragged.data.current, dragged.id);
        if (isSidebarDropData(over.data.current)) return t().over(what, over.data.current.label);
        const at = place(over);
        return at ? t().movedTo(what, at) : undefined;
      },
      onDragEnd: ({ active: dragged, over }) => {
        const what = subject(dragged.data.current, dragged.id);
        if (over && isSidebarDropData(over.data.current)) {
          return t().droppedOn(what, over.data.current.label);
        }
        const at = over ? place(over) : null;
        return at ? t().droppedAt(what, at) : t().dropped(what);
      },
      onDragCancel: ({ active: dragged }) =>
        t().cancelled(subject(dragged.data.current, dragged.id)),
    };
  }, []);

  const draggingIds = useMemo(() => (active ? new Set(active.ids) : null), [active]);
  const value = useMemo<BoardDnd>(
    () => ({
      dragging: active !== null || sortingSection !== null,
      sortingSection,
      draggingIds,
      wasJustDragged,
      isDragActive,
      registerReorder,
      registerRowReorder,
    }),
    [
      active,
      sortingSection,
      draggingIds,
      wasJustDragged,
      isDragActive,
      registerReorder,
      registerRowReorder,
    ],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: getActiveMessages().shell.dnd.instructions },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
      <BoardDndContext.Provider value={value}>{children}</BoardDndContext.Provider>
      {/* Dropping on a sidebar row ends the drag where it is: no fly-back to the old slot. */}
      <DragOverlay
        dropAnimation={reduced || overTarget ? null : { duration: 150, easing: "ease-out" }}
      >
        {active ? <DragPreview drag={active} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
