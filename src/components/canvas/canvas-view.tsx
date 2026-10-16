"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useStoreApi,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { isDialogOpen, isEditableElement } from "@/components/capture/paste-listener";
import { useViewer } from "@/components/providers/viewer-provider";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import {
  SNAP_GRID,
  itemsToNodes,
  reconcileNodes,
  snapPoint,
  unplacedNodes,
  type ItemFlowNode,
  type Point,
} from "@/lib/canvas/layout";
import { registerCanvasPlacer } from "@/lib/canvas/placement";
import {
  nodeToCanvasRect,
  useCanvasLayoutSaver,
  type CanvasLayoutSaverApi,
  type CanvasRect,
} from "@/lib/canvas/save";
import { canvasShortcut, type CanvasAction } from "@/lib/canvas/shortcuts";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  useInitialViewport,
  useViewportSaver,
  type CanvasViewport,
} from "@/lib/canvas/viewport";
import { bringToFront, sendToBack } from "@/lib/canvas/z-order";
import type { BoardItem } from "@/lib/items/queries";
import { useUiStore } from "@/stores/ui-store";
import { CanvasContext, type CanvasContextValue } from "./canvas-context";
import { CanvasControls, useCanvasViewportActions } from "./canvas-controls";
import { CanvasMenu, type MenuTarget } from "./canvas-menu";
import { ItemNode } from "./item-node";
import { MoveDialog } from "./move-dialog";
import { useCanvasActions, type CanvasActions } from "./use-canvas-actions";

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

type CanvasInnerProps = Omit<CanvasViewProps, "persist"> & {
  persistence?: CanvasPersistence;
  /** Creating notes and moving cards; only a persisted canvas has them. */
  actions?: CanvasActions;
};

function CanvasInner({ items, onOpen, onRetry, persistence, actions }: CanvasInnerProps) {
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
    const fresh = unplacedNodes(nodes).filter((node) => !layout.hasSeen(node.id));
    if (fresh.length > 0) layout.enqueue(fresh.map(nodeToCanvasRect));
  }, [nodes, layout]);
  const minimap = useUiStore((state) => state.canvasMinimap);
  const snap = useUiStore((state) => state.canvasSnap);
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  });

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
      if (layout && resized.size > 0) {
        layout.enqueue(next.filter((node) => resized.has(node.id)).map(nodeToCanvasRect));
      }
    },
    [layout],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: ItemFlowNode, dragged: ItemFlowNode[]) =>
      layout?.enqueue(dragged.map(nodeToCanvasRect)),
    [layout],
  );

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: CanvasViewport) => onViewportChange?.(viewport),
    [onViewportChange],
  );

  const { screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();
  const viewport = useCanvasViewportActions();
  const [moveOpen, setMoveOpen] = useState(false);

  /** Flow coordinates under a pointer position; outside the canvas or `null` = viewport center. */
  const flowPointAt = useCallback(
    (client: Point | null): Point => {
      const bounds = store.getState().domNode?.getBoundingClientRect();
      const inside =
        client !== null &&
        bounds !== undefined &&
        client.x >= bounds.left &&
        client.x <= bounds.right &&
        client.y >= bounds.top &&
        client.y <= bounds.bottom;
      const at =
        inside || !bounds
          ? (client ?? { x: 0, y: 0 })
          : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const point = screenToFlowPosition(at);
      return snapRef.current ? snapPoint(point) : point;
    },
    [screenToFlowPosition, store],
  );

  // Drops and pastes outside React land where this canvas says (only a persisted canvas places).
  useEffect(
    () => (actions ? registerCanvasPlacer({ flowPointAt }) : undefined),
    [actions, flowPointAt],
  );

  const selectedIds = useCallback(
    () => nodesRef.current.filter((node) => node.selected).map((node) => node.id),
    [],
  );

  const reorder = useCallback(
    (direction: "front" | "back") => {
      const ids = selectedIds();
      if (ids.length === 0) return;
      const zNodes = nodesRef.current.map((node) => ({
        id: node.id,
        zIndex: node.zIndex ?? node.data.item.canvas_z,
      }));
      const zs = direction === "front" ? bringToFront(zNodes, ids) : sendToBack(zNodes, ids);
      const next = nodesRef.current.map((node) =>
        zs.has(node.id) ? { ...node, zIndex: zs.get(node.id) } : node,
      );
      nodesRef.current = next;
      setNodes(next);
      layout?.enqueue(next.filter((node) => zs.has(node.id)).map(nodeToCanvasRect));
    },
    [selectedIds, layout],
  );

  const moveSelected = useCallback(
    (collectionId: string | null, label: string) => {
      const ids = selectedIds();
      if (ids.length > 0) actions?.moveItems(ids, collectionId, label);
    },
    [selectedIds, actions],
  );

  // The key table. Fields, open dialogs and open menus own the keyboard.
  useEffect(() => {
    function run(action: CanvasAction) {
      switch (action) {
        case "zoomIn":
          return viewport.zoomIn();
        case "zoomOut":
          return viewport.zoomOut();
        case "fitAll":
          return viewport.fitAll();
        case "zoomTo100":
          return viewport.zoomTo100();
        case "newNote":
          return actions?.createNote(flowPointAt(null));
        case "bringToFront":
          return reorder("front");
        case "sendToBack":
          return reorder("back");
        case "move":
          return actions && selectedIds().length > 0 ? setMoveOpen(true) : undefined;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableElement(target) || isEditableElement(document.activeElement)) return;
      if (isDialogOpen() || document.querySelector('[role="menu"]')) return;
      const action = canvasShortcut(event);
      if (!action) return;
      // Zoom keys must not also zoom the browser page.
      event.preventDefault();
      run(action);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [viewport, actions, flowPointAt, reorder, selectedIds]);

  // Double-click on empty space makes a note right there.
  const onDoubleClick = useCallback(
    (event: MouseEvent) => {
      if (!actions || !(event.target as Element).classList.contains("react-flow__pane")) return;
      actions.createNote(flowPointAt({ x: event.clientX, y: event.clientY }));
    },
    [actions, flowPointAt],
  );

  const resolveMenuTarget = useCallback(
    (event: MouseEvent): MenuTarget | null => {
      const element = event.target as Element;
      if (element.closest(".react-flow__panel, .react-flow__minimap")) return null;
      const nodeId = element.closest<HTMLElement>(".react-flow__node")?.dataset.id;
      if (nodeId) {
        // Right-clicking a card outside the selection selects just that card first.
        if (!nodesRef.current.find((node) => node.id === nodeId)?.selected) {
          const next = nodesRef.current.map((node) => ({ ...node, selected: node.id === nodeId }));
          nodesRef.current = next;
          setNodes(next);
        }
        return { type: "node", id: nodeId };
      }
      return { type: "pane", point: flowPointAt({ x: event.clientX, y: event.clientY }) };
    },
    [flowPointAt],
  );

  const selectionSize = nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const thumbnails = useSignedUrls(items.map((item) => item.thumbnail_path));
  const context = useMemo<CanvasContextValue>(
    () => ({ thumbnails, onOpen, onRetry }),
    [thumbnails, onOpen, onRetry],
  );

  return (
    <CanvasContext.Provider value={context}>
      <CanvasMenu
        resolveTarget={resolveMenuTarget}
        selectionSize={selectionSize}
        collectionId={actions?.collectionId ?? null}
        onOpen={
          onOpen
            ? (id) => {
                const item = itemsById.get(id);
                if (item) onOpen(item);
              }
            : undefined
        }
        onMoveTo={actions ? moveSelected : undefined}
        onBringToFront={() => reorder("front")}
        onSendToBack={() => reorder("back")}
        onNewNote={actions?.createNote}
      >
        <ReactFlow<ItemFlowNode>
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
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
          zoomOnDoubleClick={false}
          onDoubleClick={onDoubleClick}
          snapToGrid={snap}
          snapGrid={[SNAP_GRID, SNAP_GRID]}
          nodesConnectable={false}
          // Removing items is the app's job (Trash with Undo), not React Flow's Backspace.
          deleteKeyCode={null}
          proOptions={PRO_OPTIONS}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
          {minimap ? <MiniMap pannable zoomable ariaLabel="Minimap" /> : null}
          <CanvasControls />
        </ReactFlow>
      </CanvasMenu>
      {actions ? (
        <MoveDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          count={selectionSize}
          currentCollectionId={actions.collectionId}
          onPick={moveSelected}
        />
      ) : null}
    </CanvasContext.Provider>
  );
}

function PersistedInner({
  persist,
  ...props
}: CanvasInnerProps & { persist: CanvasPersistTarget }) {
  const actions = useCanvasActions(persist.type === "inbox" ? null : persist.collectionId);
  return <CanvasInner {...props} actions={actions} />;
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
  return <PersistedInner {...props} persist={persist} persistence={persistence} />;
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
