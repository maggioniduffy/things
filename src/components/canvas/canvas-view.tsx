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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useViewer } from "@/components/providers/viewer-provider";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import {
  itemsToNodes,
  reconcileNodes,
  unplacedNodes,
  type ItemFlowNode,
} from "@/lib/canvas/layout";
import {
  nodeToCanvasRect,
  useCanvasLayoutSaver,
  type CanvasLayoutSaverApi,
  type CanvasRect,
} from "@/lib/canvas/save";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  useInitialViewport,
  useViewportSaver,
  type CanvasViewport,
} from "@/lib/canvas/viewport";
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
   * Which canvas this is, so layout and viewport are saved. Leave out for a canvas with nothing
   * behind it (the styleguide demo); it then only holds local state.
   */
  persist?: CanvasPersistTarget;
};

/** The Inbox or one collection. */
export type CanvasPersistTarget = { type: "inbox" } | { type: "collection"; collectionId: string };

/** What the canvas does to keep itself: queue layout changes, remember the viewport. */
type CanvasPersistence = {
  layout: CanvasLayoutSaverApi;
  /** Registers who moves nodes back to their last saved layout after a failed save. */
  setRollbackHandler: (handler: (rects: CanvasRect[]) => void) => void;
  initialViewport: CanvasViewport | null;
  onViewportChange: (viewport: CanvasViewport) => void;
};

type CanvasInnerProps = Omit<CanvasViewProps, "persist"> & { persistence?: CanvasPersistence };

function CanvasInner({ items, onOpen, onRetry, persistence }: CanvasInnerProps) {
  const [nodes, setNodes] = useState<ItemFlowNode[]>(() => itemsToNodes(items));
  const [initialViewport] = useState(() => persistence?.initialViewport ?? null);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  });
  const layout = persistence?.layout;
  const setRollbackHandler = persistence?.setRollbackHandler;
  const onViewportChange = persistence?.onViewportChange;

  // A failed save moves the nodes back to their last saved layout.
  useEffect(() => {
    setRollbackHandler?.((rects) => {
      const byId = new Map(rects.map((rect) => [rect.id, rect]));
      setNodes((current) =>
        current.map((node) => {
          const rect = byId.get(node.id);
          return rect
            ? {
                ...node,
                position: { x: rect.x, y: rect.y },
                width: rect.w,
                height: rect.h,
                zIndex: rect.z,
              }
            : node;
        }),
      );
    });
  }, [setRollbackHandler]);

  // Items without a stored position were auto-placed above; save them once, in one batch.
  useEffect(() => {
    if (!layout) return;
    // If the save of a never-saved auto-placed node fails, it stays unplaced in the cache and is
    // auto-placed (and queued) again on the next mount; acceptable, and `hasSeen` stops a retry loop.
    const fresh = unplacedNodes(nodes).filter((node) => !layout.hasSeen(node.id));
    if (fresh.length > 0) layout.enqueue(fresh.map(nodeToCanvasRect));
  }, [nodes, layout]);
  const minimap = useUiStore((state) => state.canvasMinimap);

  // New, removed and patched items reach the nodes; local positions survive a refetch.
  // Adjusted during render rather than in an effect, so no frame shows stale nodes.
  const [syncedItems, setSyncedItems] = useState(items);
  if (syncedItems !== items) {
    setSyncedItems(items);
    setNodes((current) => reconcileNodes(current, items));
  }

  const onNodesChange = useCallback(
    (changes: NodeChange<ItemFlowNode>[]) => {
      const next = applyNodeChanges(changes, nodesRef.current);
      nodesRef.current = next;
      setNodes(next);
      // Resize end (`resizing === false`; plain measuring leaves it undefined): save the new size.
      const resized = new Set(
        changes.flatMap((change) =>
          change.type === "dimensions" && change.resizing === false ? [change.id] : [],
        ),
      );
      // A move that has ended: a drag drop and every arrow-key nudge both arrive as a position
      // change with `dragging: false` (mid-drag changes say `true`). Keyboard moves never fire
      // onNodeDragStop, so this is the single path for both.
      const moved = new Set(
        changes.flatMap((change) =>
          change.type === "position" && change.dragging === false ? [change.id] : [],
        ),
      );
      if (layout && (resized.size > 0 || moved.size > 0)) {
        layout.enqueue(
          next.filter((node) => resized.has(node.id) || moved.has(node.id)).map(nodeToCanvasRect),
        );
      }
    },
    [layout],
  );

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: CanvasViewport) => onViewportChange?.(viewport),
    [onViewportChange],
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
        nodeTypes={NODE_TYPES}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onMoveEnd={onMoveEnd}
        // A saved viewport wins; otherwise start fitted to the content.
        defaultViewport={initialViewport ?? undefined}
        fitView={initialViewport === null}
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

function PersistedCanvas({
  persist,
  ...props
}: Omit<CanvasViewProps, "persist"> & { persist: CanvasPersistTarget }) {
  const { userId } = useViewer();
  const target = useMemo(
    () => (persist.type === "inbox" ? { type: "inbox" as const, userId } : persist),
    [persist, userId],
  );
  const initial = useInitialViewport(target);
  const onViewportChange = useViewportSaver(target);

  const rollbackHandler = useRef<(rects: CanvasRect[]) => void>(() => {});
  const layout = useCanvasLayoutSaver(props.items, (rects) => rollbackHandler.current(rects));
  const setRollbackHandler = useCallback((handler: (rects: CanvasRect[]) => void) => {
    rollbackHandler.current = handler;
  }, []);

  const persistence = useMemo<CanvasPersistence>(
    () => ({ layout, setRollbackHandler, initialViewport: initial.viewport, onViewportChange }),
    [layout, setRollbackHandler, initial.viewport, onViewportChange],
  );
  // The viewport decides how the canvas first paints, so wait for a collection's to load.
  if (!initial.ready) return null;
  return <CanvasInner {...props} persistence={persistence} />;
}

/** The infinite board of an Inbox or collection. Fills its parent; give that parent a height. */
export function CanvasView({ persist, ...props }: CanvasViewProps) {
  return (
    <div
      role="region"
      aria-label="Canvas"
      data-view-mode="canvas"
      className="relative min-h-96 flex-1"
    >
      <div className="absolute inset-0">
        <ReactFlowProvider>
          {persist ? <PersistedCanvas persist={persist} {...props} /> : <CanvasInner {...props} />}
        </ReactFlowProvider>
      </div>
    </div>
  );
}
