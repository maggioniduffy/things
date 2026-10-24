"use client";

import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { memo, useCallback, useMemo, type CSSProperties, type Ref } from "react";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { CardChromeContext } from "@/components/cards/card-shell";
import { ItemCard } from "@/components/cards/item-card";
import type { CardVariant } from "@/components/cards/types";
import { useBoardDnd, type CardDragData } from "@/components/dnd/board-dnd-provider";
import { useT } from "@/i18n/client";
import { focusRing } from "@/components/ui/focus-ring";
import type { BoardItem } from "@/lib/items/queries";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/** How a board card takes part in drag and drop. Trash has none. */
export type CardDnd = "sortable" | "draggable";

type BoardCardProps = {
  item: BoardItem;
  variant: CardVariant;
  thumbnailUrl?: string | null;
  onOpen?: (item: BoardItem) => void;
  onRetry?: (item: BoardItem) => void | Promise<void>;
  /**
   * Motion props for the card's own `li` (an open folder's stretch in and out). Layout animation
   * is off while these are set.
   */
  liMotion?: Pick<HTMLMotionProps<"li">, "initial" | "animate" | "exit" | "style">;
};

type FrameProps = BoardCardProps & {
  /** Reorder (manual sort) or just move to the sidebar. Names the handle; absent = no drag. */
  handleLabel?: (title: string) => string;
  /** dnd-kit wiring; all absent for a card that cannot be dragged. */
  setNodeRef?: Ref<HTMLDivElement>;
  setActivatorNodeRef?: (node: HTMLElement | null) => void;
  listeners?: Record<string, unknown>;
  attributes?: object;
  dragStyle?: CSSProperties;
  isDragging?: boolean;
};

/**
 * The shared frame of a board card. The outer `motion.li` owns Motion layout; the inner element
 * owns the dnd-kit node and transform, so the two libraries never write `transform` on the same
 * element. A plain wrapper between them is the mobile stack's sticky element. It also carries the selected state (an outline in the focus token).
 */
function CardFrame({
  item,
  variant,
  thumbnailUrl,
  onOpen,
  onRetry,
  liMotion,
  handleLabel,
  setNodeRef,
  setActivatorNodeRef,
  listeners,
  attributes,
  dragStyle,
  isDragging,
}: FrameProps) {
  const t = useT().shell.board;
  const card = useT().shell.card;
  const ui = useBoardDnd();
  const reduced = useReducedMotion() ?? false;
  const selected = useUiStore((state) => state.selectedIds.includes(item.id));
  const selectMode = useUiStore((state) => state.selectMode);
  const cursor = useUiStore((state) => state.cursorId === item.id);

  const layout = ui?.dragging || reduced || liMotion ? false : "position";
  const wasJustDragged = ui?.wasJustDragged;
  const open = useCallback(
    (target: BoardItem) => {
      if (wasJustDragged?.()) return;
      onOpen?.(target);
    },
    [wasJustDragged, onOpen],
  );

  const carried = isDragging || (ui?.draggingIds?.has(item.id) ?? false);
  const chrome = useMemo(
    () => ({
      as: "div" as const,
      selected: selectMode ? selected : undefined,
      dragHandle: handleLabel ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          aria-label={handleLabel(itemDisplayTitle(item, card).replace(/\s+/g, " "))}
          className={cn(
            "text-ink-muted hover:bg-accent hover:text-ink rounded-control relative z-20 flex size-6 shrink-0 cursor-grab items-center justify-center",
            "opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 focus-visible:opacity-100",
            variant === "grid" && "bg-surface absolute top-1.5 right-1.5",
            focusRing,
          )}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
      ) : undefined,
    }),
    [handleLabel, setActivatorNodeRef, attributes, item, variant, card, selectMode, selected],
  );

  return (
    <motion.li layout={layout} className="list-none" {...liMotion}>
      {/* Mobile stack: this wrapper is the sticky, scroll-animated element (see globals.css). */}
      <div data-stack-card="" className="h-full">
        <div
          ref={setNodeRef}
          {...listeners}
          data-sortable-id={item.id}
          data-selected={selected ? "true" : undefined}
          data-cursor={cursor ? "true" : undefined}
          aria-current={cursor ? "true" : undefined}
          style={{ ...dragStyle, opacity: carried ? 0.4 : 1 }}
          className={cn(
            "relative h-full select-none [&>*]:h-full",
            "data-[selected=true]:*:outline-focus data-[selected=true]:*:outline-2 data-[selected=true]:*:-outline-offset-1",
            // The keyboard cursor: an outset ring in the same token, so it reads with a selection.
            "data-[cursor=true]:*:outline-focus data-[cursor=true]:*:outline-2 data-[cursor=true]:*:outline-offset-2",
          )}
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
          {selected ? <span className="sr-only">{t.selected}</span> : null}
        </div>
      </div>
    </motion.li>
  );
}

function useDragData(item: BoardItem, variant: CardVariant, thumbnailUrl?: string | null) {
  return useMemo<CardDragData>(
    () => ({ item, variant, thumbnailUrl }),
    [item, variant, thumbnailUrl],
  );
}

/** A card the user can reorder (manual sort) and drop on the sidebar. */
export const SortableCard = memo(function SortableCard(props: BoardCardProps) {
  const t = useT().shell.board;
  const { item, variant, thumbnailUrl } = props;
  const reduced = useReducedMotion() ?? false;
  const data = useDragData(item, variant, thumbnailUrl);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data });
  const dragStyle = useMemo<CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition: reduced ? undefined : transition,
    }),
    [transform, transition, reduced],
  );
  return (
    <CardFrame
      {...props}
      handleLabel={t.reorder}
      setNodeRef={setNodeRef}
      setActivatorNodeRef={setActivatorNodeRef}
      listeners={listeners}
      attributes={attributes}
      dragStyle={dragStyle}
      isDragging={isDragging}
    />
  );
});

/** A card that can only be dropped on the sidebar (any sort other than manual). */
export const DraggableCard = memo(function DraggableCard(props: BoardCardProps) {
  const t = useT().shell.board;
  const { item, variant, thumbnailUrl } = props;
  const data = useDragData(item, variant, thumbnailUrl);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id,
    data,
  });
  return (
    <CardFrame
      {...props}
      handleLabel={t.move}
      setNodeRef={setNodeRef}
      setActivatorNodeRef={setActivatorNodeRef}
      listeners={listeners}
      attributes={attributes}
      isDragging={isDragging}
    />
  );
});

/** A card with no drag at all (Trash), still selectable. */
export const StaticCard = memo(function StaticCard(props: BoardCardProps) {
  return <CardFrame {...props} />;
});

/** One card of a board in the given drag mode (none in Trash). */
export function BoardCard({ dnd, ...props }: BoardCardProps & { dnd?: CardDnd }) {
  if (dnd === "sortable") return <SortableCard {...props} />;
  if (dnd === "draggable") return <DraggableCard {...props} />;
  return <StaticCard {...props} />;
}
