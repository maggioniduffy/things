"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import { itemsToNodes, reconcileNodes, type ItemFlowNode } from "@/lib/canvas/layout";
import type { BoardItem } from "@/lib/items/queries";
import { useUiStore } from "@/stores/ui-store";
import { CanvasContext, type CanvasContextValue } from "./canvas-context";
import { CanvasControls } from "./canvas-controls";
import { ItemNode } from "./item-node";

const NODE_TYPES: NodeTypes = { item: ItemNode };
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 } as const;
const PRO_OPTIONS = { hideAttribution: true } as const;
/** Above this many nodes only those in the viewport are rendered. */
const VISIBLE_ONLY_ABOVE = 300;

type CanvasViewProps = {
  /** Every item of the view; the caller loads all pages first. Order does not matter here. */
  items: readonly BoardItem[];
  onOpen?: (item: BoardItem) => void;
  onRetry?: (item: BoardItem) => void | Promise<void>;
  /**
   * Seam for saving (WP 6.2): called with the nodes whose position or size the user changed,
   * once the change is final (drag or resize end).
   */
  onLayoutChange?: (nodes: readonly ItemFlowNode[]) => void;
};

function CanvasInner({ items, onOpen, onRetry, onLayoutChange }: CanvasViewProps) {
  const [nodes, setNodes] = useState<ItemFlowNode[]>(() => itemsToNodes(items));
  const minimap = useUiStore((state) => state.canvasMinimap);

  // New, removed and patched items reach the nodes; local positions survive a refetch.
  // Adjusted during render rather than in an effect, so no frame shows stale nodes.
  const [syncedItems, setSyncedItems] = useState(items);
  if (syncedItems !== items) {
    setSyncedItems(items);
    setNodes((current) => reconcileNodes(current, items));
  }

  const onNodesChange = useCallback((changes: NodeChange<ItemFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: ItemFlowNode, dragged: ItemFlowNode[]) => onLayoutChange?.(dragged),
    [onLayoutChange],
  );

  const thumbnails = useSignedUrls(items.map((item) => item.thumbnail_path));
  const context = useMemo<CanvasContextValue>(
    () => ({ thumbnails, onOpen, onRetry }),
    [thumbnails, onOpen, onRetry],
  );

  return (
    <CanvasContext.Provider value={context}>
      <ReactFlow<ItemFlowNode>
        nodes={nodes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={NODE_TYPES}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        onlyRenderVisibleElements={nodes.length > VISIBLE_ONLY_ABOVE}
        // Left-drag on empty space draws a marquee; space-drag, middle mouse, trackpad scroll and
        // touch pan. Pinch or ⌘/Ctrl-scroll zooms.
        selectionOnDrag
        panOnDrag={[1]}
        panOnScroll
        panActivationKeyCode="Space"
        nodesConnectable={false}
        // Removing items is the app's job (Trash with Undo), not React Flow's Backspace.
        deleteKeyCode={null}
        proOptions={PRO_OPTIONS}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
        {minimap ? <MiniMap pannable zoomable ariaLabel="Minimap" /> : null}
        <CanvasControls />
      </ReactFlow>
    </CanvasContext.Provider>
  );
}

/** The infinite board of an Inbox or collection. Fills its parent; give that parent a height. */
export function CanvasView(props: CanvasViewProps) {
  return (
    <div
      role="region"
      aria-label="Canvas"
      data-view-mode="canvas"
      className="relative min-h-96 flex-1"
    >
      <div className="absolute inset-0">
        <ReactFlowProvider>
          <CanvasInner {...props} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
