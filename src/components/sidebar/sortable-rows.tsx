"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent } from "@dnd-kit/core";
import { GripVerticalIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useBoardDnd } from "@/components/dnd/board-dnd-provider";
import {
  sidebarSortId,
  type SidebarSortData,
  type SidebarSortSection,
} from "@/components/dnd/targets";
import { focusRing } from "@/components/ui/focus-ring";
import { moveRow, type OrderedRow } from "@/lib/order";
import { useSidebarReorder } from "@/lib/sidebar/reorder";
import { cn } from "@/lib/utils";

/** A dropped order, shown until the cache catches up. Only valid while `base` is the current list. */
type DroppedOrder<T> = { base: readonly T[]; ids: readonly string[] };

type SortableRowsProps<T extends OrderedRow> = {
  section: SidebarSortSection;
  /** The section's rows in display order (the query result). */
  rows: readonly T[];
  children: (rows: readonly T[]) => ReactNode;
};

/**
 * Drag-to-reorder for one sidebar list. It sits in the board's DndContext (so a card can still be
 * dropped on a row's link) and registers what a drop of one of its rows does: one `position`
 * update through `useSidebarReorder`. Rows only trade places inside their own section.
 */
export function SortableRows<T extends OrderedRow>({
  section,
  rows,
  children,
}: SortableRowsProps<T>) {
  const dnd = useBoardDnd();
  const registerRowReorder = dnd?.registerRowReorder;
  const reorder = useSidebarReorder(section);

  // The cache update lands a tick after the drop; showing the dropped order in the commit that ends
  // the drag keeps the rows from snapping back to their old slots for a frame.
  const [dropped, setDropped] = useState<DroppedOrder<T> | null>(null);
  const shown = useMemo(() => {
    if (!dropped || dropped.base !== rows) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    return dropped.ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
  }, [dropped, rows]);
  const ids = useMemo(() => shown.map((row) => row.id), [shown]);
  const sortIds = useMemo(() => ids.map((id) => sidebarSortId(section, id)), [ids, section]);

  const onDrop = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const fromIndex = sortIds.indexOf(String(active.id));
      const toIndex = sortIds.indexOf(String(over.id));
      if (fromIndex === -1 || toIndex === -1) return;
      const order: DroppedOrder<T> = { base: rows, ids: moveRow(ids, fromIndex, toIndex) };
      setDropped(order);
      void reorder(ids[fromIndex] ?? "", toIndex).finally(() =>
        setDropped((current) => (current === order ? null : current)),
      );
    },
    [ids, reorder, rows, sortIds],
  );
  useEffect(() => registerRowReorder?.(section, onDrop), [registerRowReorder, section, onDrop]);

  return (
    <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
      {children(shown)}
    </SortableContext>
  );
}

/** What a sortable sidebar row needs: its node ref and style, and the handle to put inside it. */
export type SortableRow = {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  handle: ReactNode;
};

/**
 * Makes a sidebar row sortable. `label` names the row for screen readers ("collection Reading").
 * The handle is a button so keyboard users can pick the row up (Space, arrows, Space) and a
 * pointer drag can never be mistaken for a click on the row's link.
 */
export function useSortableRow(
  section: SidebarSortSection,
  id: string,
  label: string,
): SortableRow {
  const reduced = useReducedMotion() ?? false;
  const cardDragging = useBoardDnd()?.draggingIds != null;
  const data = useMemo<SidebarSortData>(
    () => ({ type: "sidebar-sort", section, id, label }),
    [section, id, label],
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sidebarSortId(section, id),
    data,
    // While a card is dragged these rows are not places for it: only their links are.
    disabled: { droppable: cardDragging },
  });

  const style = useMemo<CSSProperties>(
    () => ({
      transform: CSS.Translate.toString(transform),
      transition: reduced ? undefined : transition,
    }),
    [transform, transition, reduced],
  );

  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Drag to reorder ${label}`}
      className={cn(
        "text-ink-muted hover:bg-accent hover:text-ink rounded-control absolute top-1/2 right-9 flex size-6 -translate-y-1/2 cursor-grab touch-none items-center justify-center",
        "opacity-0 transition-opacity duration-(--duration-fast) group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100",
        "max-md:opacity-100",
        focusRing,
      )}
    >
      <GripVerticalIcon aria-hidden="true" className="size-4" />
    </button>
  );

  return { setNodeRef, style, isDragging, handle };
}
