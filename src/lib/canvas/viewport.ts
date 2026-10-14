"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

export type CanvasViewport = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
export const VIEWPORT_DEBOUNCE_MS = 1000;

/** A stored viewport if it has the right shape (finite numbers), with the zoom clamped; else null. */
export function parseViewport(value: unknown): CanvasViewport | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { x, y, zoom } = value as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number" || typeof zoom !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
  return { x, y, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) };
}

// ---------------------------------------------------------------------------
// Inbox: localStorage, one key per user (the Inbox has no row to hold it)
// ---------------------------------------------------------------------------

export function inboxViewportKey(userId: string): string {
  return `things-canvas-viewport:${userId}`;
}

export function readInboxViewport(userId: string): CanvasViewport | null {
  try {
    const raw = localStorage.getItem(inboxViewportKey(userId));
    return raw === null ? null : parseViewport(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeInboxViewport(userId: string, viewport: CanvasViewport): void {
  try {
    localStorage.setItem(inboxViewportKey(userId), JSON.stringify(viewport));
  } catch {
    // Storage blocked or full: the viewport just isn't remembered.
  }
}

// ---------------------------------------------------------------------------
// Collections: collections.canvas_viewport
// ---------------------------------------------------------------------------

type Client = SupabaseClient<Database>;

export function collectionViewportKey(collectionId: string) {
  return ["collection-viewport", collectionId] as const;
}

/**
 * The saved viewport of one collection. Kept apart from the sidebar's `["collections"]` list so a
 * pan never re-renders the sidebar. Once loaded (or patched by a save) it is authoritative for
 * this tab, so a remount right after a save does not race the write.
 */
export function collectionViewportQueryOptions(client: Client, collectionId: string) {
  return queryOptions({
    queryKey: collectionViewportKey(collectionId),
    queryFn: async (): Promise<CanvasViewport | null> => {
      const { data, error } = await client
        .from("collections")
        .select("canvas_viewport")
        .eq("id", collectionId)
        .maybeSingle();
      if (error) throw error;
      return parseViewport(data?.canvas_viewport);
    },
    staleTime: Infinity,
  });
}

// ---------------------------------------------------------------------------
// Debounced saving
// ---------------------------------------------------------------------------

/** Keeps the latest viewport and saves it once moves have stopped for `delay`. */
export class ViewportSaver {
  private latest: CanvasViewport | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly save: (viewport: CanvasViewport) => void | Promise<void>,
    private readonly delay = VIEWPORT_DEBOUNCE_MS,
  ) {}

  schedule(viewport: CanvasViewport): void {
    this.latest = viewport;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delay);
  }

  /** Saves a waiting viewport now. */
  flush(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const viewport = this.latest;
    this.latest = null;
    if (viewport) void Promise.resolve(this.save(viewport)).catch(() => {});
  }
}

export type CanvasViewportTarget =
  { type: "inbox"; userId: string } | { type: "collection"; collectionId: string };

/** The viewport to open with. `ready` is false while a collection's viewport is still loading. */
export function useInitialViewport(target: CanvasViewportTarget): {
  ready: boolean;
  viewport: CanvasViewport | null;
} {
  const collectionId = target.type === "collection" ? target.collectionId : null;
  const query = useQuery({
    ...collectionViewportQueryOptions(createClient(), collectionId ?? ""),
    enabled: collectionId !== null,
  });
  const [inboxViewport] = useState(() =>
    target.type === "inbox" ? readInboxViewport(target.userId) : null,
  );
  if (target.type === "inbox") return { ready: true, viewport: inboxViewport };
  // A failed load opens fitted to the content, like a first visit.
  return { ready: !query.isPending, viewport: query.data ?? null };
}

/** Debounced saving of the viewport; also saves when the canvas unmounts or the page is hidden. */
export function useViewportSaver(target: CanvasViewportTarget): (viewport: CanvasViewport) => void {
  const queryClient = useQueryClient();
  const collectionId = target.type === "collection" ? target.collectionId : null;
  const userId = target.type === "inbox" ? target.userId : null;

  const saver = useMemo(
    () =>
      new ViewportSaver(async (viewport) => {
        if (collectionId !== null) {
          queryClient.setQueryData(collectionViewportKey(collectionId), viewport);
          // Low stakes: if the write fails the local state stays and nobody is told.
          await createClient()
            .from("collections")
            .update({ canvas_viewport: viewport })
            .eq("id", collectionId);
        } else if (userId !== null) {
          writeInboxViewport(userId, viewport);
        }
      }),
    [queryClient, collectionId, userId],
  );

  useEffect(() => {
    const flush = () => saver.flush();
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

  return useMemo(() => (viewport) => saver.schedule(viewport), [saver]);
}
