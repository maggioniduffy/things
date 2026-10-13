"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useCallback, useContext, useRef, type PointerEvent, type MouseEvent } from "react";
import { ItemCard } from "@/components/cards/item-card";
import { cn } from "@/lib/utils";
import type { ItemFlowNode } from "@/lib/canvas/layout";
import { CanvasContext } from "./canvas-context";

/** A click that moved further than this since the pointer went down was a drag, not a click. */
const CLICK_SLOP_PX = 4;

/**
 * One item on the canvas: the grid's card filling the node. React Flow owns the node's position
 * and drag; the card's own open button still works for a plain click.
 */
export const ItemNode = memo(function ItemNode({ data, selected }: NodeProps<ItemFlowNode>) {
  const { thumbnails, onOpen, onRetry } = useContext(CanvasContext);
  const { item } = data;
  const down = useRef<{ x: number; y: number } | null>(null);

  const onPointerDownCapture = useCallback((event: PointerEvent) => {
    down.current = { x: event.clientX, y: event.clientY };
  }, []);

  // A node drag must not open the drawer: swallow the click that follows a real movement.
  const onClickCapture = useCallback((event: MouseEvent) => {
    const start = down.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
      event.stopPropagation();
      event.preventDefault();
    }
  }, []);

  return (
    <div
      onPointerDownCapture={onPointerDownCapture}
      onClickCapture={onClickCapture}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "rounded-card h-full w-full select-none",
        "data-[selected=true]:outline-focus data-[selected=true]:outline-2 data-[selected=true]:outline-offset-1",
      )}
    >
      <ul role="list" className="m-0 h-full list-none p-0 [&>li]:h-full">
        <ItemCard
          item={item}
          variant="grid"
          thumbnailUrl={item.thumbnail_path ? thumbnails.get(item.thumbnail_path) : null}
          onOpen={onOpen}
          onRetry={onRetry}
        />
      </ul>
    </div>
  );
});
