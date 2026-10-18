"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  useStoreApi,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { isDialogOpen, isEditableElement } from "@/components/capture/paste-listener";
import { useViewer } from "@/components/providers/viewer-provider";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import {
  SNAP_GRID,
  itemsToNodes,
  nodeRect,
  reconcileNodes,
  unplacedNodes,
  type CanvasTarget,
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
import { buildClipboard, type CopiedCard } from "@/lib/items/copy";
import type { NoteColor } from "@/lib/items/note-colors";
import type { BoardItem } from "@/lib/items/queries";
import { useCanvasClipboard, type CanvasClipboard } from "@/stores/canvas-clipboard";
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
  // fitView moves the viewport without a pointer event; that first move is not the user's and must
  // not be saved as one. Only set when fitView runs (no saved viewport) over existing nodes.
  const skipFitMoveRef = useRef(initialViewport === null && nodes.length > 0);
  // A ⌘C keydown waiting to see whether the browser fires a `copy` event for it (Safari may not).
  const copyPendingRef = useRef(false);
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
    // If the save of a never-saved auto-placed node fails, the saver retries it with its next batch;
    // `hasSeen` keeps this effect from queueing it again in a loop.
    const fresh = unplacedNodes(nodes).filter((node) => !layout.hasSeen(node.id));
    if (fresh.length > 0) layout.enqueue(fresh.map(nodeToCanvasRect));
  }, [nodes, layout]);
  const minimap = useUiStore((state) => state.canvasMinimap);
  const snap = useUiStore((state) => state.canvasSnap);
  const hand = useUiStore((state) => state.canvasTool) === "hand";
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  });

  // New, removed and patched items reach the nodes; local positions survive a refetch.
  // Adjusted during render rather than in an effect, so no frame shows stale nodes.
  const [syncedItems, setSyncedItems] = useState(items);
  // Ids of fresh copies that become the selection as soon as their cards show up.
  const [pendingSelect, setPendingSelect] = useState<readonly string[] | null>(null);
  if (syncedItems !== items) {
    setSyncedItems(items);
    const present = pendingSelect ? items.some((item) => pendingSelect.includes(item.id)) : false;
    if (pendingSelect && present) {
      setPendingSelect(null);
      setNodes((current) =>
        reconcileNodes(current, items).map((node) => {
          const selected = pendingSelect.includes(node.id);
          return node.selected === selected ? node : { ...node, selected };
        }),
      );
    } else {
      setNodes((current) => reconcileNodes(current, items));
    }
  }

  const onNodesChange = useCallback(
    (changes: NodeChange<ItemFlowNode>[]) => {
      // An updater, so a rollback or reconcile still waiting to be applied is not overwritten.
      setNodes((current) => applyNodeChanges(changes, current));
      const next = applyNodeChanges(changes, nodesRef.current);
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

  // A real pointer or touch event means the user took over: stop expecting the fitView move.
  const onMoveStart = useCallback((event: unknown) => {
    if (event) skipFitMoveRef.current = false;
  }, []);
  const onMoveEnd = useCallback(
    (event: unknown, viewport: CanvasViewport) => {
      // Programmatic moves (fitView, zoom buttons) pass no event; only the first one is skipped.
      if (!event && skipFitMoveRef.current) {
        skipFitMoveRef.current = false;
        return;
      }
      onViewportChange?.(viewport);
    },
    [onViewportChange],
  );

  const { screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();
  const viewport = useCanvasViewportActions();
  const [moveOpen, setMoveOpen] = useState(false);

  /**
   * Flow coordinates under a pointer position; outside the canvas or `null` = viewport center.
   * The z stacks a new card above every existing one.
   */
  const flowPointAt = useCallback(
    (client: Point | null): CanvasTarget => {
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
      const z = nodesRef.current.reduce((top, node) => Math.max(top, node.zIndex ?? 0), 0) + 1;
      // The corner snaps, not the center, so it is placed with the card's size known.
      return { ...point, snap: snapRef.current, z };
    },
    [screenToFlowPosition, store],
  );

  // The last pointer position over the canvas (client coordinates); null once it has left.
  const pointerRef = useRef<Point | null>(null);
  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const onPointerLeave = useCallback(() => {
    pointerRef.current = null;
  }, []);

  const setClipboard = useCanvasClipboard((state) => state.setClipboard);
  const canPaste = useCanvasClipboard((state) => state.clipboard !== null);

  const selectedIds = useCallback(
    () => nodesRef.current.filter((node) => node.selected).map((node) => node.id),
    [],
  );

  const selectedCards = useCallback(
    (): CopiedCard[] =>
      nodesRef.current
        .filter((node) => node.selected)
        .map((node) => ({ item: node.data.item, ...nodeRect(node) })),
    [],
  );

  /** Puts the selected cards on the in-app clipboard. Returns the text for the system one. */
  const copySelection = useCallback((): string | null => {
    if (!actions) return null;
    const clipboard = buildClipboard(selectedCards());
    if (!clipboard) return null;
    setClipboard(clipboard);
    return clipboard.text;
  }, [actions, selectedCards, setClipboard]);

  /** The menu's Copy: no `copy` event there, so the system clipboard is written directly. */
  const copyFromMenu = useCallback(() => {
    const text = copySelection();
    if (text !== null) void navigator.clipboard?.writeText(text).catch(() => undefined);
  }, [copySelection]);

  const duplicateSelected = useCallback(() => {
    const cards = selectedCards();
    if (!actions || cards.length === 0) return;
    actions.duplicateCards(cards, flowPointAt(null).z ?? 0, setPendingSelect);
  }, [actions, selectedCards, flowPointAt]);

  const pasteClipboard = useCallback(
    (clipboard: CanvasClipboard, at: CanvasTarget) => {
      actions?.pasteCopies(clipboard, at, setPendingSelect);
    },
    [actions],
  );

  const pasteFromMenu = useCallback(
    (at?: CanvasTarget) => {
      const clipboard = useCanvasClipboard.getState().clipboard;
      if (clipboard) pasteClipboard(clipboard, at ?? flowPointAt(null));
    },
    [pasteClipboard, flowPointAt],
  );

  // Drops and pastes outside React land where this canvas says (only a persisted canvas places).
  useEffect(
    () =>
      actions
        ? registerCanvasPlacer({
            flowPointAt,
            pasteCopies: (clipboard) => pasteClipboard(clipboard, flowPointAt(pointerRef.current)),
          })
        : undefined,
    [actions, flowPointAt, pasteClipboard],
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
      const restack = (node: ItemFlowNode) =>
        zs.has(node.id) ? { ...node, zIndex: zs.get(node.id) } : node;
      // An updater, so a node added by a reconcile not yet committed to the ref survives.
      setNodes((current) => current.map(restack));
      // A z change has no NodeChange of its own, so it is queued here rather than in onNodesChange.
      layout?.enqueue(
        nodesRef.current
          .filter((node) => zs.has(node.id))
          .map(restack)
          .map(nodeToCanvasRect),
      );
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

  const colorSelected = useCallback(
    (color: NoteColor | null) => {
      const ids = selectedIds();
      if (ids.length > 0) actions?.colorNotes(ids, color);
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
        case "selectTool":
          return useUiStore.getState().setCanvasTool("select");
        case "handTool":
          return useUiStore.getState().setCanvasTool("hand");
        case "duplicate":
          return duplicateSelected();
        case "copy":
          return undefined;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableElement(target) || isEditableElement(document.activeElement)) return;
      if (isDialogOpen() || document.querySelector('[role="menu"]')) return;
      const action = canvasShortcut(event);
      if (!action) return;
      // ⌘C is the browser's: its `copy` event (below) does the work, and cancelling the key
      // would stop that event. Safari may fire none for a canvas selection, so if no `copy` event
      // handled it by the next task, copy from here.
      if (action === "copy") {
        if (!actions || selectedIds().length === 0) return;
        if ((window.getSelection()?.toString() ?? "") !== "") return;
        copyPendingRef.current = true;
        setTimeout(() => {
          if (!copyPendingRef.current) return;
          copyPendingRef.current = false;
          copyFromMenu();
        }, 0);
        return;
      }
      // ⌘/Ctrl +/− zoom the canvas only while it (or nothing) has focus; elsewhere they stay the
      // browser's page zoom.
      const focused = document.activeElement;
      const canvasFocused =
        !focused || focused === document.body || focused.closest('[data-view-mode="canvas"]');
      if ((action === "zoomIn" || action === "zoomOut") && !canvasFocused) return;
      // Zoom keys must not also zoom the browser page.
      event.preventDefault();
      run(action);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [viewport, actions, flowPointAt, reorder, selectedIds, duplicateSelected, copyFromMenu]);

  // ⌘C and the browser's Copy: the cards go to the in-app clipboard, their text to the system one.
  useEffect(() => {
    if (!actions) return;
    function onCopy(event: ClipboardEvent) {
      copyPendingRef.current = false;
      if (event.defaultPrevented || !event.clipboardData) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableElement(target) || isEditableElement(document.activeElement)) return;
      if (isDialogOpen() || document.querySelector('[role="menu"]')) return;
      // Text the user selected on the page is theirs to copy.
      if ((window.getSelection()?.toString() ?? "") !== "") return;
      const text = copySelection();
      if (text === null) return;
      event.clipboardData.setData("text/plain", text);
      event.preventDefault();
    }
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [actions, copySelection]);

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
      // After a marquee, the selection's box covers the selected cards: treat it as one of them.
      if (element.closest(".react-flow__nodesselection")) {
        const selected = nodesRef.current.find((node) => node.selected);
        if (selected) return { type: "node", id: selected.id };
      }
      const nodeId = element.closest<HTMLElement>(".react-flow__node")?.dataset.id;
      if (nodeId) {
        // Right-clicking a card outside the selection selects just that card first.
        if (!nodesRef.current.find((node) => node.id === nodeId)?.selected) {
          setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
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
        onColor={actions ? colorSelected : undefined}
        isNote={(id) => itemsById.get(id)?.kind === "note"}
        onBringToFront={() => reorder("front")}
        onSendToBack={() => reorder("back")}
        onNewNote={actions?.createNote}
        onCopy={actions ? copyFromMenu : undefined}
        onDuplicate={actions ? duplicateSelected : undefined}
        onPaste={actions ? pasteFromMenu : undefined}
        canPaste={canPaste}
      >
        <ReactFlow<ItemFlowNode>
          nodes={nodes}
          onNodesChange={onNodesChange}
          nodeTypes={NODE_TYPES}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveStart={onMoveStart}
          onMoveEnd={onMoveEnd}
          // A saved viewport wins; otherwise start fitted to the content.
          defaultViewport={initialViewport ?? undefined}
          fitView={initialViewport === null}
          fitViewOptions={FIT_VIEW_OPTIONS}
          onlyRenderVisibleElements={nodes.length > VISIBLE_ONLY_ABOVE}
          // Left-drag on empty space draws a marquee; space-drag, middle mouse, trackpad scroll and
          // touch pan. Pinch or ⌘/Ctrl-scroll zooms.
          selectionOnDrag={!hand}
          nodesDraggable={!hand}
          className={hand ? "canvas-hand" : undefined}
          // A marquee picks every card it touches, not only the ones it fully covers.
          selectionMode={SelectionMode.Partial}
          // Selecting must not lift a card; the stack order is what ] and [ set.
          elevateNodesOnSelect={false}
          panOnDrag={hand ? true : [1]}
          panOnScroll
          panActivationKeyCode="Space"
          zoomOnDoubleClick={false}
          onDoubleClick={onDoubleClick}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
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
