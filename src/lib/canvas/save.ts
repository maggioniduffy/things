"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { patchInPages } from "@/lib/items/cache";
import type { BoardItem, ItemsPage } from "@/lib/items/queries";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";
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
  /** Called when a batch was saved, with what the server now holds. */
  onSaved?: (layout: CanvasRect[]) => void;
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
  /** Never-saved rects whose batch failed: they ride along with the next batch, with no timer of their own. */
  private readonly retry = new Map<string, CanvasRect>();
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
    this.mergeRetries();
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
    this.mergeRetries();
    if (this.pending.size === 0) return Promise.resolve();

    const batch = [...this.pending.values()];
    this.pending.clear();
    const run = (async () => {
      await this.options.onFlush?.(batch);
      await this.options.save(batch);
    })().then(
      () => {
        for (const rect of batch) this.lastSaved.set(rect.id, rect);
        this.options.onSaved?.(batch);
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

  dispose(): void {
    this.clearTimer();
  }

  private fail(batch: readonly CanvasRect[]): void {
    // A node with a newer change waiting is about to be saved again; leave it alone.
    const restore = batch
      .filter((rect) => !this.pending.has(rect.id))
      .map((rect): CanvasRestore => ({ id: rect.id, rect: this.lastSaved.get(rect.id) ?? null }));
    // Never-saved nodes have nothing to roll back to; keep them for the next batch instead.
    for (const entry of restore) {
      const rect = batch.find((candidate) => candidate.id === entry.id);
      if (rect && entry.rect === null) this.retry.set(rect.id, rect);
    }
    const rollback = restore.flatMap((entry) => (entry.rect ? [entry.rect] : []));
    this.options.onFailure?.({ restore, rollback });
  }

  /** Moves the retry entries into `pending`; a newer rect for the same id stays. */
  private mergeRetries(): void {
    for (const [id, rect] of this.retry) if (!this.pending.has(id)) this.pending.set(id, rect);
    this.retry.clear();
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

/** Browsers cap the body of a keepalive request at 64 KiB. */
const KEEPALIVE_LIMIT_BYTES = 64 * 1024;

/**
 * A fetch that adds `keepalive: true`, so a save started on pagehide still completes after the
 * page is gone. Larger bodies go out as a normal request (keepalive would reject them).
 */
export function keepaliveFetch(base: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return (input, init) => {
    const body = init?.body;
    const size =
      typeof body === "string"
        ? new Blob([body]).size
        : body == null
          ? 0
          : Number.POSITIVE_INFINITY;
    return base(input, size <= KEEPALIVE_LIMIT_BYTES ? { ...init, keepalive: true } : init);
  };
}

let keepaliveClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Used only by the layout saver; a separate client so the global fetch of the rest stays plain.
 * One per page (not per canvas mount): every client starts its own auth listeners.
 */
function createKeepaliveClient() {
  if (keepaliveClient) return keepaliveClient;
  const { url, publishableKey } = getSupabaseEnv();
  keepaliveClient = createBrowserClient<Database>(url, publishableKey, {
    isSingleton: false,
    global: { fetch: keepaliveFetch() },
    // The main client owns token refresh; this one only reads the shared session.
    auth: { autoRefreshToken: false },
  });
  return keepaliveClient;
}

export type CanvasLayoutSaverApi = {
  enqueue: (rects: readonly CanvasRect[]) => void;
  hasSeen: (id: string) => boolean;
};

/**
 * Debounced, optimistic saving of canvas layouts for the items currently on screen.
 * `onRollback` receives the last saved layout of nodes whose save failed, so the canvas can move
 * them back; the cache is restored and an error toast shown here.
 */
export function useCanvasLayoutSaver(
  items: readonly BoardItem[],
  onRollback: (rects: CanvasRect[]) => void,
): CanvasLayoutSaverApi {
  const queryClient = useQueryClient();

  /** The stored layout of an item before this saver touched it; null when it has none. */
  function baselineIn(list: readonly BoardItem[]) {
    return (id: string): CanvasRect | null => {
      const item = list.find((candidate) => candidate.id === id);
      if (!item || item.canvas_x === null || item.canvas_y === null) return null;
      // A stored position without a stored size rolls back to the size the node had by default.
      const { w, h } = defaultNodeSize(item);
      return { id, x: item.canvas_x, y: item.canvas_y, w, h, z: item.canvas_z };
    };
  }

  function failureHandler({
    restore,
    rollback,
  }: {
    restore: CanvasRestore[];
    rollback: CanvasRect[];
  }) {
    patchItemCaches(
      queryClient,
      restore.map(({ id, rect }) => ({
        id,
        patch: rect
          ? layoutPatch(rect)
          : { canvas_x: null, canvas_y: null, canvas_w: null, canvas_h: null, canvas_z: 0 },
      })),
    );
    if (rollback.length > 0) onRollback(rollback);
    toast.error(LAYOUT_SAVE_ERROR);
  }

  const [saver] = useState(() => {
    const client = createKeepaliveClient();
    return new CanvasLayoutSaver({
      save: async (layout) => {
        const { error } = await client.rpc("save_canvas_layout", { layout });
        if (error) throw error;
      },
      baseline: baselineIn(items),
      onFlush: (layout) => {
        // A read that started before this save would bring the old layout back into the cache.
        void queryClient.cancelQueries({ queryKey: ["items"] });
        patchItemCaches(
          queryClient,
          layout.map((rect) => ({ id: rect.id, patch: layoutPatch(rect) })),
        );
      },
      // A read that finished while the save was in flight may hold the old layout: patch again.
      onSaved: (layout) =>
        patchItemCaches(
          queryClient,
          layout.map((rect) => ({ id: rect.id, patch: layoutPatch(rect) })),
        ),
      onFailure: failureHandler,
    });
  });

  // Before any passive effect (the canvas queues auto-placed items in one), so baselines and the
  // rollback target are the latest.
  useLayoutEffect(() => {
    saver.update({ baseline: baselineIn(items), onFailure: failureHandler });
  });

  useEffect(() => {
    const flush = () => void saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [saver]);

  return saver;
}
