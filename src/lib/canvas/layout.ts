import type { Node } from "@xyflow/react";
import type { BoardItem } from "@/lib/items/queries";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = Pick<Rect, "w" | "h">;

/** Gap between auto-placed nodes, and between them and the existing content. */
export const AUTO_PLACE_GAP = 24;

const IMAGE_WIDTH = 320;
const IMAGE_MIN_HEIGHT = 120;

/** The data every canvas node carries; the item is replaced in place when its row changes. */
export type ItemNodeData = { item: BoardItem };
export type ItemFlowNode = Node<ItemNodeData, "item">;

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Natural pixel size of an image item, when `metadata` carries one. */
function imageDimensions(item: BoardItem): Size | null {
  const metadata = item.metadata;
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const w = positiveNumber(metadata.width);
  const h = positiveNumber(metadata.height);
  return w && h ? { w, h } : null;
}

/** Size by kind when the item has none stored. */
function kindSize(item: BoardItem): Size {
  switch (item.kind) {
    case "link":
    case "article":
      return { w: 280, h: 240 };
    case "note":
      return { w: 240, h: 160 };
    case "image": {
      const natural = imageDimensions(item);
      if (!natural) return { w: IMAGE_WIDTH, h: 240 };
      return {
        w: IMAGE_WIDTH,
        h: Math.max(IMAGE_MIN_HEIGHT, Math.round((IMAGE_WIDTH * natural.h) / natural.w)),
      };
    }
    default:
      return { w: 240, h: 200 };
  }
}

/** The node size of an item: stored `canvas_w`/`canvas_h` win, otherwise the default for its kind. */
export function defaultNodeSize(item: BoardItem): Size {
  const fallback = kindSize(item);
  return { w: item.canvas_w ?? fallback.w, h: item.canvas_h ?? fallback.h };
}

export function hasCanvasPosition(item: BoardItem): boolean {
  return item.canvas_x !== null && item.canvas_y !== null;
}

/**
 * Stacks `unplaced` items in one column to the right of the placed content: x is the content's
 * right edge plus the gap, y starts at its top and each next item sits a gap below the previous.
 * With nothing placed the column starts at (0, 0). Deterministic: follows input order.
 */
export function autoPlace(
  placed: readonly Rect[],
  unplaced: readonly (Size & { id: string })[],
): Map<string, Rect> {
  const result = new Map<string, Rect>();
  if (unplaced.length === 0) return result;

  let x = 0;
  let y = 0;
  if (placed.length > 0) {
    x = Math.max(...placed.map((rect) => rect.x + rect.w)) + AUTO_PLACE_GAP;
    y = Math.min(...placed.map((rect) => rect.y));
  }
  for (const entry of unplaced) {
    result.set(entry.id, { x, y, w: entry.w, h: entry.h });
    y += entry.h + AUTO_PLACE_GAP;
  }
  return result;
}

/** The rect a node occupies now: its position and size, falling back to the item's default size. */
export function nodeRect(node: ItemFlowNode): Rect {
  const fallback = defaultNodeSize(node.data.item);
  return {
    x: node.position.x,
    y: node.position.y,
    w: node.width ?? fallback.w,
    h: node.height ?? fallback.h,
  };
}

function makeNode(item: BoardItem, rect: Rect): ItemFlowNode {
  return {
    id: item.id,
    type: "item",
    position: { x: rect.x, y: rect.y },
    width: rect.w,
    height: rect.h,
    zIndex: item.canvas_z,
    data: { item },
  };
}

/**
 * Brings a node list up to date with `items`: new items become nodes (stored position, or
 * auto-placed right of everything already there), removed items drop out, and existing nodes keep
 * their local position and size while `data.item` follows the row. Returns `previous` itself when
 * nothing changed, so React Flow state does not churn on a no-op refetch.
 */
export function reconcileNodes(
  previous: readonly ItemFlowNode[],
  items: readonly BoardItem[],
): ItemFlowNode[] {
  const known = new Map(previous.map((node) => [node.id, node]));
  const placed: Rect[] = [];
  const fresh: BoardItem[] = [];
  for (const item of items) {
    const node = known.get(item.id);
    if (node) placed.push(nodeRect(node));
    else if (hasCanvasPosition(item)) {
      const { w, h } = defaultNodeSize(item);
      placed.push({ x: item.canvas_x ?? 0, y: item.canvas_y ?? 0, w, h });
    } else fresh.push(item);
  }
  const autoPlaced = autoPlace(
    placed,
    fresh.map((item) => ({ id: item.id, ...defaultNodeSize(item) })),
  );

  const next = items.map((item) => {
    const node = known.get(item.id);
    if (node) return node.data.item === item ? node : { ...node, data: { item } };
    const stored = hasCanvasPosition(item);
    if (stored) {
      const { w, h } = defaultNodeSize(item);
      return makeNode(item, { x: item.canvas_x ?? 0, y: item.canvas_y ?? 0, w, h });
    }
    const rect = autoPlaced.get(item.id);
    return makeNode(item, rect ?? { x: 0, y: 0, ...defaultNodeSize(item) });
  });

  const unchanged =
    next.length === previous.length && next.every((node, i) => node === previous[i]);
  return unchanged ? (previous as ItemFlowNode[]) : next;
}

/**
 * Nodes whose item has no stored canvas position, i.e. the ones `reconcileNodes` auto-placed (or
 * that were auto-placed and not saved yet). They still need to be saved.
 */
export function unplacedNodes(nodes: readonly ItemFlowNode[]): ItemFlowNode[] {
  return nodes.filter((node) => !hasCanvasPosition(node.data.item));
}

/** Nodes for a list of items: stored positions and sizes, defaults by kind, the rest auto-placed. */
export function itemsToNodes(items: readonly BoardItem[]): ItemFlowNode[] {
  return reconcileNodes([], items);
}

// ---------------------------------------------------------------------------
// Placing things where they happen
// ---------------------------------------------------------------------------

export type Point = { x: number; y: number };

/** Grid of the optional snap, in flow pixels. */
export const SNAP_GRID = 8;
/** Offset between the cards of one multi-item drop or paste. */
export const CASCADE_STEP = 24;

/** The top-left corner a node of `size` needs for its center to sit at `point`. */
export function placeCentered(point: Point, size: Size): Point {
  return { x: point.x - size.w / 2, y: point.y - size.h / 2 };
}

/** Where request `index` of a multi-item gesture goes: `origin` plus `index` steps of 24 px. */
export function cascadePoint(origin: Point, index: number): Point {
  return { x: origin.x + index * CASCADE_STEP, y: origin.y + index * CASCADE_STEP };
}

/** Rounds a point to the snap grid. */
export function snapPoint(point: Point, grid: number = SNAP_GRID): Point {
  return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}

/** `row` with canvas coordinates that put its node's center at `point` (size stays null). */
export function placeRowAt(row: BoardItem, point: Point): BoardItem {
  const corner = placeCentered(point, defaultNodeSize(row));
  return { ...row, canvas_x: corner.x, canvas_y: corner.y };
}
