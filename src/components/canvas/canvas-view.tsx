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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useViewer } from "@/components/providers/viewer-provider";
import { useBatchMove } from "@/lib/items/batch-mutations";
import { useCapture, type NoteOptions } from "@/lib/items/mutations";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import {
  NOTE_SIZE,
  itemsToNodes,
  reconcileNodes,
  unplacedNodes,
  zOrderChanges,
  type ItemFlowNode,
  type ZOrderMode,
} from "@/lib/canvas/layout";
import {
  centerOfViewport,
  useCanvasPlacer,
  type CanvasPlacer,
  type CanvasPoint,
} from "@/lib/canvas/placement";
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
import type { ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { CanvasContext, type CanvasContextValue } from "./canvas-context";
import { CanvasControls } from "./canvas-controls";
import {
  CanvasContextMenu,
  CanvasMoveMenu,
  useMoveTargets,
  type CanvasMenuTarget,
  type MoveTarget,
} from "./canvas-menus";
import { ItemNode } from "./item-node";
import { NoteComposer } from "./note-composer";
import { useCanvasShortcuts } from "./use-canvas-shortcuts";

const NODE_TYPES: NodeTypes = { item: ItemNode };
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 } as const;
const PRO_OPTIONS = { hideAttribution: true } as const;
const SNAP_GRID: [number, number] = [8, 8];
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
  /** Saves a note into this canvas's collection (or the Inbox), at a flow point. */
  captureNote: (text: string, options: NoteOptions | undefined, at: CanvasPoint) => Promise<void>;
  /** The collection this canvas shows; null for the Inbox. Moving a card there does nothing. */
  currentId: string | null;
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
  const snap = useUiStore((state) => state.canvasSnap);

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

  const flow = useReactFlow();
  const store = useStoreApi();
  const flowRef = useRef(flow);
  useEffect(() => {
    flowRef.current = flow;
  });

  // Drops and pastes ask the canvas where to put things: a screen point becomes a flow point, no
  // point means the middle of what is on screen.
  useEffect(() => {
    const placer: CanvasPlacer = (client) => {
      if (client) return flowRef.current.screenToFlowPosition(client);
      const { width, height } = store.getState();
      return centerOfViewport(flowRef.current.getViewport(), { width, height });
    };
    useCanvasPlacer.getState().setPlacer(placer);
    return () => {
      if (useCanvasPlacer.getState().placer === placer) useCanvasPlacer.getState().setPlacer(null);
    };
  }, [store]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [composer, setComposer] = useState<CanvasPoint | null>(null);
  const [menuTarget, setMenuTarget] = useState<CanvasMenuTarget>({
    kind: "pane",
    at: { x: 0, y: 0 },
  });
  const [moveMenu, setMoveMenu] = useState<{ x: number; y: number; ids: string[] } | null>(null);
  const captureNote = persistence?.captureNote;
  const currentId = persistence?.currentId ?? null;
  const targets = useMoveTargets(persistence !== undefined);
  const batchMove = useBatchMove();

  const selectedIds = useCallback(
    () => nodesRef.current.filter((node) => node.selected).map((node) => node.id),
    [],
  );

  // Z-order: applied to the nodes at once and saved as one layout batch.
  const reorder = useCallback(
    (mode: ZOrderMode) => {
      const changes = zOrderChanges(nodesRef.current, new Set(selectedIds()), mode);
      if (changes.size === 0) return;
      const next = nodesRef.current.map((node) =>
        changes.has(node.id) ? { ...node, zIndex: changes.get(node.id) } : node,
      );
      nodesRef.current = next;
      setNodes(next);
      layout?.enqueue(next.filter((node) => changes.has(node.id)).map(nodeToCanvasRect));
    },
    [layout, selectedIds],
  );

  const moveSelection = useCallback(
    (target: MoveTarget, ids: readonly string[]) => {
      setMoveMenu(null);
      if (ids.length > 0) void batchMove(ids, { type: "collection", id: target.id }, target.name);
    },
    [batchMove],
  );

  const openMoveMenu = useCallback(() => {
    if (targets.length === 0) return;
    const ids = selectedIds();
    const first = ids[0];
    if (first === undefined) return;
    const root = wrapperRef.current;
    const element = root?.querySelector(`.react-flow__node[data-id="${CSS.escape(first)}"]`);
    const box = (element ?? root)?.getBoundingClientRect();
    setMoveMenu({
      x: box?.left ?? 0,
      y: box ? (element ? box.bottom : box.top + box.height / 2) : 0,
      ids,
    });
  }, [selectedIds, targets.length]);

  const openComposer = useCallback(
    (at: CanvasPoint) => {
      if (captureNote) setComposer(at);
    },
    [captureNote],
  );

  useCanvasShortcuts({
    // From the keyboard the note is centered on the viewport (a double-click puts its corner
    // under the cursor).
    newNote: () => {
      const { width, height } = store.getState();
      const center = centerOfViewport(flow.getViewport(), { width, height });
      openComposer({ x: center.x - NOTE_SIZE.w / 2, y: center.y - NOTE_SIZE.h / 2 });
    },
    forward: () => reorder("forward"),
    backward: () => reorder("backward"),
    openMove: openMoveMenu,
  });

  const onNodeContextMenu = useCallback((_event: unknown, node: ItemFlowNode) => {
    // Right-clicking a card outside the selection selects it first; inside, the selection stays.
    if (!node.selected) {
      const next = nodesRef.current.map((candidate) => ({
        ...candidate,
        selected: candidate.id === node.id,
      }));
      nodesRef.current = next;
      setNodes(next);
    }
    setMenuTarget({ kind: "node", id: node.id });
  }, []);

  const thumbnails = useSignedUrls(items.map((item) => item.thumbnail_path));
  const context = useMemo<CanvasContextValue>(
    () => ({ thumbnails, onOpen, onRetry }),
    [thumbnails, onOpen, onRetry],
  );

  return (
    <CanvasContext.Provider value={context}>
      <CanvasContextMenu
        target={menuTarget}
        targets={targets}
        currentId={currentId}
        onOpen={(id) => {
          const item = items.find((candidate) => candidate.id === id);
          if (item) onOpen?.(item);
        }}
        onMove={(target) => {
          const ids = selectedIds();
          moveSelection(
            target,
            ids.length > 0 ? ids : menuTarget.kind === "node" ? [menuTarget.id] : [],
          );
        }}
        onZOrder={reorder}
        onNewNote={openComposer}
      >
        <div
          ref={wrapperRef}
          className="h-full w-full"
          onContextMenuCapture={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            // The controls and the minimap keep the browser's own menu.
            if (target?.closest(".react-flow__panel, .react-flow__minimap")) {
              event.stopPropagation();
              return;
            }
            setMenuTarget({
              kind: "pane",
              at: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            });
          }}
          onDoubleClick={(event) => {
            // Only empty space: cards, controls and the minimap are other elements.
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.classList.contains("react-flow__pane")) return;
            openComposer(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          }}
        >
          <ReactFlow<ItemFlowNode>
            nodes={nodes}
            onNodesChange={onNodesChange}
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={NODE_TYPES}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onMoveEnd={onMoveEnd}
            // A saved viewport wins; otherwise start fitted to the content.
            defaultViewport={initialViewport ?? undefined}
            fitView={initialViewport === null}
            fitViewOptions={FIT_VIEW_OPTIONS}
            onlyRenderVisibleElements={nodes.length > VISIBLE_ONLY_ABOVE}
            snapToGrid={snap}
            snapGrid={SNAP_GRID}
            // Left-drag on empty space draws a marquee; space-drag, middle mouse, trackpad scroll and
            // touch pan. Pinch or ⌘/Ctrl-scroll zooms. A double-click is for new notes, not zoom.
            selectionOnDrag
            panOnDrag={[1]}
            panOnScroll
            panActivationKeyCode="Space"
            zoomOnDoubleClick={false}
            nodesConnectable={false}
            // Removing items is the app's job (Trash with Undo), not React Flow's Backspace.
            deleteKeyCode={null}
            proOptions={PRO_OPTIONS}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
            {minimap ? <MiniMap pannable zoomable ariaLabel="Minimap" /> : null}
            <CanvasControls />
            {composer ? (
              <NoteComposer
                key={`${composer.x}:${composer.y}`}
                at={composer}
                onSave={(text) => {
                  setComposer(null);
                  void captureNote?.(text, undefined, composer);
                }}
                onCancel={() => setComposer(null)}
              />
            ) : null}
          </ReactFlow>
        </div>
      </CanvasContextMenu>
      <CanvasMoveMenu
        open={moveMenu !== null}
        onOpenChange={(open) => {
          if (!open) setMoveMenu(null);
        }}
        anchor={moveMenu}
        targets={targets}
        currentId={currentId}
        count={moveMenu?.ids.length ?? 0}
        onMove={(target) => moveSelection(target, moveMenu?.ids ?? [])}
      />
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

  const view = useMemo<ViewSpec>(
    () =>
      persist.type === "inbox"
        ? { type: "inbox" }
        : { type: "collection", collectionId: persist.collectionId },
    [persist],
  );
  const { captureNote } = useCapture(view);
  const currentId = persist.type === "collection" ? persist.collectionId : null;

  const persistence = useMemo<CanvasPersistence>(
    () => ({
      layout,
      setRollbackHandler,
      initialViewport: initial.viewport,
      onViewportChange,
      captureNote,
      currentId,
    }),
    [layout, setRollbackHandler, initial.viewport, onViewportChange, captureNote, currentId],
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
