"use client";

import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { patchInPages } from "@/lib/items/cache";
import type { BoardItem, ItemsPage } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/client";
import { defaultNodeSize, nodeRect, type ItemFlowNode } from "./layout";

/** One node's layout as `save_canvas_layout` takes it. */
export type CanvasRect = { id: string; x: number; y: number; w: number; h: number; z: number };

/** What a failed save leaves behind for one node: its last saved layout, or null if it never saved. */
export type CanvasRestore = { id: string; rect: CanvasRect | null };

export const LAYOUT_DEBOUNCE_MS = 400;
export const LAYOUT_SAVE_ERROR = "Couldn't save the canvas layout.";

/** Positions and sizes are stored as `real`; 0.1 px is far below anything visible and keeps the payload small. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function normalizeRect(rect: CanvasRect): CanvasRect {
  return {
    id: rect.id,
    x: round(rect.x),
    y: round(rect.y),
    w: round(rect.w),
    h: round(rect.h),
    z: Math.round(rect.z),
  };
}

/** The layout of a React Flow node (size falls back to the item's stored or default size). */
export function nodeToCanvasRect(node: ItemFlowNode): CanvasRect {
  const { x, y, w, h } = nodeRect(node);
  return { id: node.id, x, y, w, h, z: node.zIndex ?? node.data.item.canvas_z };
}

type SaverOptions = {
  /** One RPC for the whole batch; rejects when it fails. */
  save: (layout: CanvasRect[]) => Promise<void>;
  /** The stored layout of an item before this saver touched it; null when it has none. */
  baseline: (id: string) => CanvasRect | null;
  /** Called as a batch goes out, before the request resolves (optimistic cache patch). */
  onFlush?: (layout: CanvasRect[]) => void;
  /** Called when a batch failed. `rollback` lists the nodes to move back, `restore` every node of the batch. */
  onFailure?: (result: { restore: CanvasRestore[]; rollback: CanvasRect[] }) => void;
  debounceMs?: number;
};

/**
 * Collects layout changes and saves them in one batch after a quiet period. Never runs two saves
 * at once and never drops a change: what arrives while a save is in flight goes out right after.
 * Framework-free so the timing can be tested with fake timers.
 */
export class CanvasLayoutSaver {
  private readonly pending = new Map<string, CanvasRect>();
  /** Last layout the server confirmed per id; null = never saved (e.g. just auto-placed). */
  private readonly lastSaved = new Map<string, CanvasRect | null>();
  private readonly known = new Set<string>();
  /** Ids whose first save failed: forgotten by `releaseFailed` so a later trigger queues them again. */
  private readonly failedFresh = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(private options: SaverOptions) {}

  /** Swaps callbacks (e.g. to see newer items) without losing what is pending. */
  update(options: Partial<SaverOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /** Whether `id` was ever enqueued: auto-placement must not queue it again after a failed save. */
  hasSeen(id: string): boolean {
    return this.known.has(id);
  }

  enqueue(rects: readonly CanvasRect[]): void {
    if (rects.length === 0) return;
    for (const rect of rects) {
      const clean = normalizeRect(rect);
      if (!this.lastSaved.has(clean.id)) {
        const stored = this.options.baseline(clean.id);
        this.lastSaved.set(clean.id, stored && normalizeRect(stored));
      }
      this.known.add(clean.id);
      this.pending.set(clean.id, clean);
    }
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.debounceMs ?? LAYOUT_DEBOUNCE_MS);
  }

  /** Saves everything pending now. While a save is in flight it goes out as soon as that one ends. */
  flush(): Promise<void> {
    this.clearTimer();
    if (this.inFlight) return this.inFlight;
    if (this.pending.size === 0) return Promise.resolve();

    const batch = [...this.pending.values()];
    this.pending.clear();
    this.options.onFlush?.(batch);
    const run = (async () => this.options.save(batch))().then(
      () => {
        for (const rect of batch) this.lastSaved.set(rect.id, rect);
      },
      () => this.fail(batch),
    );
    this.inFlight = run.then(() => {
      this.inFlight = null;
      // A flush asked for during the save, or a debounce that ran out meanwhile, is still owed.
      if (this.pending.size > 0 && this.timer === null) void this.flush();
    });
    return this.inFlight;
  }

  /** Forgets nodes that never saved and whose save failed, so the next auto-placement queues them again. */
  releaseFailed(): void {
    for (const id of this.failedFresh) {
      this.known.delete(id);
      this.lastSaved.delete(id);
    }
    this.failedFresh.clear();
  }

  dispose(): void {
    this.clearTimer();
  }

  private fail(batch: readonly CanvasRect[]): void {
    // A node with a newer change waiting is about to be saved again; leave it alone.
    const restore = batch
      .filter((rect) => !this.pending.has(rect.id))
      .map((rect): CanvasRestore => ({ id: rect.id, rect: this.lastSaved.get(rect.id) ?? null }));
    for (const entry of restore) if (entry.rect === null) this.failedFresh.add(entry.id);
    const rollback = restore.flatMap((entry) => (entry.rect ? [entry.rect] : []));
    this.options.onFailure?.({ restore, rollback });
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

type Items = InfiniteData<ItemsPage>;

function layoutPatch(rect: CanvasRect): Partial<BoardItem> {
  return {
    canvas_x: rect.x,
    canvas_y: rect.y,
    canvas_w: rect.w,
    canvas_h: rect.h,
    canvas_z: rect.z,
  };
}

/** Patches only the canvas columns of the cached rows; `position` and everything else stay. */
function patchItemCaches(
  queryClient: QueryClient,
  entries: readonly { id: string; patch: Partial<BoardItem> }[],
): void {
  queryClient.setQueriesData<Items>({ queryKey: ["items"] }, (data) => {
    if (!data || !Array.isArray(data.pages)) return data;
    return entries.reduce((current, entry) => patchInPages(current, entry.id, entry.patch), data);
  });
}

export type CanvasLayoutSaverApi = {
  enqueue: (rects: readonly CanvasRect[]) => void;
  hasSeen: (id: string) => boolean;
  /** Listens for nodes to move back after a failed save; returns the unsubscribe. */
  subscribeRollback: (listener: (rects: CanvasRect[]) => void) => () => void;
};

/**
 * The one saver of a QueryClient. Canvases come and go (Board remounts on every view or sort
 * change); a single instance keeps saves strictly sequential across them and lets a failure
 * reach whichever canvas is mounted now.
 */
class SharedLayoutSaver implements CanvasLayoutSaverApi {
  private readonly listeners = new Set<(rects: CanvasRect[]) => void>();
  private mounted = 0;
  private readonly saver: CanvasLayoutSaver;

  constructor(queryClient: QueryClient) {
    const client = createClient();
    this.saver = new CanvasLayoutSaver({
      save: async (layout) => {
        const { error } = await client.rpc("save_canvas_layout", { layout });
        if (error) throw error;
      },
      baseline: (id) => storedLayout(queryClient, id),
      onFlush: (layout) =>
        patchItemCaches(
          queryClient,
          layout.map((rect) => ({ id: rect.id, patch: layoutPatch(rect) })),
        ),
      onFailure: ({ restore, rollback }) => {
        patchItemCaches(
          queryClient,
          restore.map(({ id, rect }) => ({
            id,
            patch: rect
              ? layoutPatch(rect)
              : { canvas_x: null, canvas_y: null, canvas_w: null, canvas_h: null, canvas_z: 0 },
          })),
        );
        if (rollback.length > 0) for (const listener of this.listeners) listener(rollback);
        toast.error(LAYOUT_SAVE_ERROR);
        // Nobody is looking at the canvas any more: let the next one queue those nodes again.
        if (this.mounted === 0) this.saver.releaseFailed();
      },
    });
  }

  enqueue = (rects: readonly CanvasRect[]) => this.saver.enqueue(rects);
  hasSeen = (id: string) => this.saver.hasSeen(id);
  flush = () => this.saver.flush();

  subscribeRollback = (listener: (rects: CanvasRect[]) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** A canvas mounted; returns its unmount. The last one out flushes at once. */
  attach(): () => void {
    this.mounted += 1;
    return () => {
      this.mounted -= 1;
      if (this.mounted === 0) {
        void this.saver.flush();
        this.saver.releaseFailed();
      }
    };
  }
}

/** The stored layout of an item in any cached list (not yet patched by this saver); null if unplaced. */
function storedLayout(queryClient: QueryClient, id: string): CanvasRect | null {
  for (const [, data] of queryClient.getQueriesData<Items>({ queryKey: ["items"] })) {
    if (!data || !Array.isArray(data.pages)) continue;
    for (const page of data.pages) {
      const item = page.items.find((candidate) => candidate.id === id);
      if (!item) continue;
      if (item.canvas_x === null || item.canvas_y === null) return null;
      // A stored position without a stored size rolls back to the size the node had by default.
      const { w, h } = defaultNodeSize(item);
      return { id, x: item.canvas_x, y: item.canvas_y, w, h, z: item.canvas_z };
    }
  }
  return null;
}

const SAVERS = new WeakMap<QueryClient, SharedLayoutSaver>();

/** @internal Exposed for tests. */
export function sharedLayoutSaver(queryClient: QueryClient): SharedLayoutSaver {
  let saver = SAVERS.get(queryClient);
  if (!saver) {
    saver = new SharedLayoutSaver(queryClient);
    SAVERS.set(queryClient, saver);
  }
  return saver;
}

/**
 * Debounced, optimistic saving of canvas layouts, shared by every canvas of this QueryClient.
 * On failure the cache is restored, an error toast shown and `subscribeRollback` listeners get the
 * last saved layout of the nodes to move back.
 */
export function useCanvasLayoutSaver(): CanvasLayoutSaverApi {
  const queryClient = useQueryClient();
  const saver = sharedLayoutSaver(queryClient);

  useEffect(() => {
    const detach = saver.attach();
    const flush = () => void saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      detach();
    };
  }, [saver]);

  return saver;
}
