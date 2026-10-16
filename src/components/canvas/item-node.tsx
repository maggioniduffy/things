"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";
import { SquareArrowOutUpRightIcon } from "lucide-react";
import { memo, useCallback, useContext, useRef, type PointerEvent, type MouseEvent } from "react";
import type { BoardItem } from "@/lib/items/queries";
import { ItemCard } from "@/components/cards/item-card";
import { cn } from "@/lib/utils";
import type { ItemFlowNode } from "@/lib/canvas/layout";
import { CanvasContext } from "./canvas-context";

/** A click that moved further than this since the pointer went down was a drag, not a click. */
const CLICK_SLOP_PX = 4;

/** Smallest a card can be resized to (the plan's 160 x 120). */
export const MIN_NODE_WIDTH = 160;
export const MIN_NODE_HEIGHT = 120;

/**
 * One item on the canvas: the grid's card filling the node. React Flow owns the node's position
 * and drag. A click only selects; a double-click, the hover button or Enter on the card opens it.
 */
export const ItemNode = memo(function ItemNode({ data, selected }: NodeProps<ItemFlowNode>) {
  const { thumbnails, onOpen, onRetry } = useContext(CanvasContext);
  const { item } = data;
  const down = useRef<{ x: number; y: number } | null>(null);

  const onPointerDownCapture = useCallback((event: PointerEvent) => {
    down.current = { x: event.clientX, y: event.clientY };
  }, []);

  /** Whether the click now reaching the card's open button came from the keyboard. */
  const keyboardClick = useRef(false);

  // A node drag must not open the drawer: swallow the click that follows a real movement.
  const onClickCapture = useCallback((event: MouseEvent) => {
    keyboardClick.current = event.detail === 0;
    const start = down.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
      event.stopPropagation();
      event.preventDefault();
    }
  }, []);

  // A mouse click on the card selects it (React Flow); only Enter or Space on it opens.
  const openFromCard = useCallback(
    (target: BoardItem) => {
      if (keyboardClick.current) onOpen?.(target);
    },
    [onOpen],
  );

  const onDoubleClick = useCallback(
    (event: MouseEvent) => {
      if ((event.target as Element).closest(".react-flow__resize-control")) return;
      onOpen?.(item);
    },
    [onOpen, item],
  );

  return (
    <div
      onPointerDownCapture={onPointerDownCapture}
      onClickCapture={onClickCapture}
      onDoubleClick={onDoubleClick}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "group/node rounded-card relative h-full w-full select-none",
        "[&_[data-slot=card-open]]:cursor-default",
        "data-[selected=true]:outline-focus data-[selected=true]:outline-2 data-[selected=true]:outline-offset-1",
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        handleClassName="bg-surface! border-focus! border-2! size-2.5! rounded-sm!"
        lineClassName="border-focus!"
      />
      <ul role="list" className="m-0 h-full list-none p-0 [&>li]:h-full">
        <ItemCard
          item={item}
          variant="grid"
          thumbnailUrl={item.thumbnail_path ? thumbnails.get(item.thumbnail_path) : null}
          onOpen={openFromCard}
          onRetry={onRetry}
        />
      </ul>
      {onOpen ? (
        // Pointer shortcut; keyboard and screen reader users open with the card's own button. A drag
        // that starts on it still moves the card, and the click after that drag is swallowed above.
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          title="Open"
          onClick={() => onOpen(item)}
          className={cn(
            "bg-surface border-line text-ink-muted shadow-card hover:text-ink",
            // A corner, not the middle: a click in the middle of a card must only select it.
            "absolute right-2 bottom-2 z-20 flex size-8",
            "cursor-pointer items-center justify-center rounded-full border backdrop-blur-md",
            "pointer-events-none opacity-0 motion-safe:transition-opacity motion-safe:duration-(--duration-fast)",
            // Also on the selected card, so touch (no hover) has it after a tap.
            "group-hover/node:pointer-events-auto group-hover/node:opacity-100",
            "group-data-[selected=true]/node:pointer-events-auto group-data-[selected=true]/node:opacity-100",
          )}
        >
          <SquareArrowOutUpRightIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
});
