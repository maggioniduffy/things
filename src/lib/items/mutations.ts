"use client";

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/providers/viewer-provider";
import { createClient } from "@/lib/supabase/client";
import { placeRowAt, type Point } from "@/lib/canvas/layout";
import { keyBefore } from "@/lib/order";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import type { SidebarCollection } from "@/lib/sidebar/queries";
import { attachTagNames } from "@/lib/tags/mutations";
import { SORT_MODES, viewHref, viewKey, type SortMode, type ViewSpec } from "@/lib/views";
import { useUploadStore } from "@/stores/upload-store";
import type { UnfurlResult } from "@/lib/unfurl/types";
import type { Database, ItemKind } from "@/types/supabase";
import {
  addToCounts,
  itemMatchesView,
  patchInPages,
  prependToPages,
  removeFromCounts,
  removeFromPages,
  viewFromKey,
} from "./cache";
import {
  detectFileKind,
  detectUrlKind,
  domainOf,
  parseUrlInput,
  refineKindAfterUnfurl,
} from "./detect-kind";
import type { BoardItem, ItemsPage } from "./queries";
import {
  UploadError,
  checkFileSize,
  filePath,
  thumbnailPath,
  toUploadError,
  uploadFile,
  type UploadErrorCode,
} from "./upload";
import { createThumbnail } from "./thumbnails";

type Client = SupabaseClient<Database>;
type Items = InfiniteData<ItemsPage>;

export type CaptureTarget = { collectionId: string | null };

/**
 * Where a capture made while looking at `view` goes: a collection view saves into that
 * collection; every other view saves to the Inbox.
 */
export function captureTargetFor(view: ViewSpec): CaptureTarget {
  return { collectionId: view.type === "collection" ? view.collectionId : null };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export const GUEST_QUOTA_COPY =
  "Guest accounts can store up to 25 MB. Add an email to keep saving files.";
const RATE_LIMIT_COPY = "Too many links saved in the last hour. Try again later.";

/** Toast copy for an upload failure (the Retry action is added by the caller). */
export function uploadErrorMessage(code: UploadErrorCode, fileName: string): string {
  switch (code) {
    case "too_large":
      return "Files can be up to 50 MB.";
    case "guest_file_too_large":
      return "Guest files can be up to 10 MB.";
    case "guest_quota":
      return GUEST_QUOTA_COPY;
    case "network":
    case "aborted":
    case "unknown":
      return `Couldn't upload ${fileName}.`;
  }
}

/** The items trigger raises `guest_quota_exceeded` (P0001) when a guest is over 10 MB / 25 MB. */
export function isGuestQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { message, code } = error as { message?: unknown; code?: unknown };
  return (
    (typeof message === "string" && message.includes("guest_quota_exceeded")) ||
    // A bare P0001 on an insert can only be our quota trigger.
    (code === "P0001" && typeof message === "string" && message.includes("quota"))
  );
}

// ---------------------------------------------------------------------------
// Rows (pure)
// ---------------------------------------------------------------------------

/** Shown until the real position is known (see `reservePosition`); never sent to the database. */
const PLACEHOLDER_POSITION = "a0";

type RowBase = { id: string; userId: string; collectionId: string | null; now: string };

function baseRow({ id, userId, collectionId, now }: RowBase, kind: ItemKind): BoardItem {
  return {
    archived_at: null,
    canvas_h: null,
    canvas_w: null,
    canvas_x: null,
    canvas_y: null,
    canvas_z: 0,
    collection_id: collectionId,
    created_at: now,
    deleted_at: null,
    description: null,
    domain: null,
    enrich_status: "pending",
    favicon_url: null,
    file_name: null,
    file_path: null,
    file_size: null,
    id,
    image_url: null,
    is_favorite: false,
    is_read: false,
    kind,
    metadata: {},
    mime_type: null,
    note: null,
    position: PLACEHOLDER_POSITION,
    site_name: null,
    thumbnail_path: null,
    title: null,
    updated_at: now,
    url: null,
    user_id: userId,
  };
}

export function buildLinkRow(base: RowBase, url: string): BoardItem {
  return { ...baseRow(base, detectUrlKind(url)), url, domain: domainOf(url) };
}

export function buildNoteRow(base: RowBase, text: string, title?: string): BoardItem {
  return {
    ...baseRow(base, "note"),
    title: title ?? null,
    note: text.trim(),
    enrich_status: "done",
  };
}

/** Extras of a note typed in quick add: a title and the `#tags` found in its text. */
export type NoteOptions = {
  title?: string;
  tagNames?: string[];
  /** Flow point on a canvas where the card's center goes; leave out to place it nowhere. */
  canvasAt?: Point;
  /** Save a note with no text (a blank canvas note to type into). Plain captures refuse it. */
  allowEmpty?: boolean;
};

/** Where a link or file lands on a canvas. */
export type CanvasCaptureOptions = { canvasAt?: Point };

/** `row` positioned at `canvasAt` when given, otherwise as is. */
function atCanvasPoint(row: BoardItem, canvasAt: Point | undefined): BoardItem {
  return canvasAt ? placeRowAt(row, canvasAt) : row;
}

/** File name without its last extension ("report.final.pdf" -> "report.final"). */
function titleFromFileName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") || name;
}

export function buildFileRow(base: RowBase, file: Pick<File, "name" | "type" | "size">): BoardItem {
  return {
    ...baseRow(base, detectFileKind(file.type, file.name)),
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    file_path: filePath(base.userId, base.id, file.name),
    title: titleFromFileName(file.name),
  };
}

/** The row patch for a successful unfurl. Null fields are skipped so a missing title stays null. */
export function unfurlPatch(kind: ItemKind, result: UnfurlResult): Partial<BoardItem> {
  const patch: Partial<BoardItem> = {
    kind: refineKindAfterUnfurl(kind, result),
    metadata: {
      ...result.metadata,
      provider: result.provider,
      canonicalUrl: result.canonicalUrl,
      finalUrl: result.finalUrl,
    },
    enrich_status: "done",
  };
  if (result.title) patch.title = result.title;
  if (result.description) patch.description = result.description;
  if (result.imageUrl) patch.image_url = result.imageUrl;
  if (result.faviconUrl) patch.favicon_url = result.faviconUrl;
  if (result.siteName) patch.site_name = result.siteName;
  return patch;
}

// ---------------------------------------------------------------------------
// Ordering: a new item goes before everything else, and quick captures stay in order
// ---------------------------------------------------------------------------

let lastKey: string | null = null;
// Position assignment is serialized: capture B's key is derived from capture A's final key.
let positionQueue: Promise<unknown> = Promise.resolve();

function minKey(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

export async function fetchFirstPosition(client: Client): Promise<string | null> {
  const { data, error } = await client
    .from("items")
    .select("position")
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data[0]?.position ?? null;
}

/**
 * A key before the user's current first item and before every key this tab handed out earlier.
 * Called synchronously at capture time so the order of calls is the order of keys.
 */
function reservePosition(client: Client): Promise<string> {
  const run = positionQueue.then(async () => {
    const first = await fetchFirstPosition(client);
    const key = keyBefore(minKey(first, lastKey));
    lastKey = key;
    return key;
  });
  positionQueue = run.catch(() => undefined);
  return run;
}

/** Test seam: forgets the keys this tab handed out. */
export function resetCaptureStateForTests(): void {
  lastKey = null;
  positionQueue = Promise.resolve();
  enriching.clear();
  inFlight = 0;
}

// ---------------------------------------------------------------------------
// Cache plumbing
// ---------------------------------------------------------------------------

function isSortMode(value: unknown): value is SortMode {
  return (SORT_MODES as readonly unknown[]).includes(value);
}

/** Applies `edit` to every cached `["items", viewKey, sort]` list; skips lists it leaves as is. */
function editLists(
  queryClient: QueryClient,
  edit: (data: Items, view: ViewSpec | null, sort: SortMode | null) => Items,
): void {
  for (const [key, data] of queryClient.getQueriesData<Items>({ queryKey: ["items"] })) {
    if (!data) continue;
    const [, vk, sort] = key;
    const next = edit(
      data,
      typeof vk === "string" ? viewFromKey(vk) : null,
      isSortMode(sort) ? sort : null,
    );
    if (next !== data) queryClient.setQueryData(key, next);
  }
}

export function insertIntoCaches(queryClient: QueryClient, row: BoardItem): void {
  editLists(queryClient, (data, view, sort) =>
    // Oldest/title lists would put it elsewhere: the refetch at the end of the capture does.
    view && (sort === "manual" || sort === "newest") && itemMatchesView(row, view)
      ? prependToPages(data, row)
      : data,
  );
  queryClient.setQueryData<SidebarCounts>(["counts"], (counts) =>
    counts ? addToCounts(counts, row) : counts,
  );
}

export function removeFromCaches(queryClient: QueryClient, row: BoardItem): void {
  editLists(queryClient, (data) => removeFromPages(data, row.id));
  queryClient.setQueryData<SidebarCounts>(["counts"], (counts) =>
    counts ? removeFromCounts(counts, row) : counts,
  );
}

function patchCaches(queryClient: QueryClient, id: string, patch: Partial<BoardItem>): void {
  editLists(queryClient, (data) => patchInPages(data, id, patch));
}

/** Writes `patch` to the row and every cached list that holds it. Throws if the database refuses. */
async function patchItem(
  { client, queryClient }: EnrichDeps,
  id: string,
  patch: Partial<BoardItem>,
): Promise<void> {
  // The cache moves first: the data is already in hand and the card should not wait for a round trip.
  // If the write fails, the refetch at the end of the capture shows what the database really has.
  patchCaches(queryClient, id, patch);
  const { error } = await client.from("items").update(patch).eq("id", id);
  if (error) throw error;
}

// Captures and retries still running in this tab. Their cards may exist only in the cache (row
// not inserted yet), so a refetch would wipe them: only the last one to finish refreshes.
let inFlight = 0;

async function refreshLists(queryClient: QueryClient): Promise<void> {
  if (inFlight > 0) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["items"] }),
    queryClient.invalidateQueries({ queryKey: ["counts"] }),
  ]);
}

/**
 * Runs a write whose cards may exist only in the cache for a while (a paste), counted as an
 * in-flight capture so no refetch wipes them; the last one to finish refreshes the lists.
 */
export async function withInFlightWrite<T>(
  queryClient: QueryClient,
  work: () => Promise<T>,
): Promise<T> {
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    await refreshLists(queryClient);
  }
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

type EnrichDeps = { client: Client; queryClient: QueryClient };
type FlowDeps = EnrichDeps & {
  userId: string;
  isGuest: boolean;
  view: ViewSpec;
  navigate: (href: string) => void;
};

/** Items being enriched right now, so a retry cannot start a second run. */
const enriching = new Set<string>();

const UNFURL_TIMEOUT_MS = 20_000;

type UnfurlOutcome = { ok: true; result: UnfurlResult } | { ok: false; status: number | null };

async function requestUnfurl(url: string): Promise<UnfurlOutcome> {
  try {
    const response = await fetch("/api/unfurl", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal:
        typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(UNFURL_TIMEOUT_MS) : null,
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, result: (await response.json()) as UnfurlResult };
  } catch {
    return { ok: false, status: null };
  }
}

function faviconFallback(url: string): string | undefined {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

async function enrichLink(
  deps: EnrichDeps,
  item: { id: string; url: string; kind: ItemKind },
): Promise<void> {
  const outcome = await requestUnfurl(item.url);

  if (outcome.ok) {
    try {
      await patchItem(deps, item.id, unfurlPatch(item.kind, outcome.result));
      return;
    } catch {
      // Could not save the details: fall through to the failed state so the card can be retried.
    }
  } else if (outcome.status === 429) {
    toast.error(RATE_LIMIT_COPY);
  }

  const favicon = faviconFallback(item.url);
  try {
    await patchItem(deps, item.id, {
      enrich_status: "failed",
      ...(favicon ? { favicon_url: favicon } : {}),
    });
  } catch {
    // The cache already shows "failed"; the refetch will correct it if the write did not land.
  }
}

async function enrichFile(
  deps: FlowDeps,
  row: BoardItem,
  file: File,
  retry: () => void,
): Promise<void> {
  const { client, queryClient, userId, isGuest } = deps;
  const progress = useUploadStore.getState();

  try {
    try {
      await uploadFile({
        client,
        file,
        path: row.file_path ?? filePath(userId, row.id, file.name),
        contentType: row.mime_type ?? "application/octet-stream",
        isGuest,
        onProgress: (value) => useUploadStore.getState().set(row.id, value),
      });
    } catch (error) {
      // The file never landed: take the card back out, in the cache and in the database. Wait for
      // the delete, or the refresh after this capture could bring the row back as "pending".
      const { code } = toUploadError(error, { isGuest });
      removeFromCaches(queryClient, row);
      const { error: deleteError } = await client
        .from("items")
        .delete()
        .eq("id", row.id)
        .then(
          (result) => result,
          (failure: unknown) => ({ error: failure }),
        );
      // Still in the database (e.g. offline): mark it failed so the card says so after a refetch.
      if (deleteError) {
        await client
          .from("items")
          .update({ enrich_status: "failed" })
          .eq("id", row.id)
          .then(
            () => undefined,
            () => undefined,
          );
      }
      const message = uploadErrorMessage(code, file.name);
      if (code === "network" || code === "unknown" || code === "aborted") {
        toast.error(message, { action: { label: "Retry", onClick: retry } });
      } else {
        toast.error(message);
      }
      return;
    }

    // A thumbnail is a nicety: any failure leaves thumbnail_path null and the item still done.
    let thumbnail: string | null = null;
    const blob = await createThumbnail(file, row.kind);
    if (blob) {
      const path = thumbnailPath(userId, row.id);
      try {
        await uploadFile({
          client,
          // The blob may be a PNG when the browser cannot encode WebP: keep its real type.
          file: new File([blob], "thumb.webp", { type: blob.type }),
          path,
          contentType: blob.type,
          isGuest,
        });
        thumbnail = path;
      } catch {
        thumbnail = null;
      }
    }

    try {
      await patchItem(deps, row.id, { thumbnail_path: thumbnail, enrich_status: "done" });
    } catch {
      // The file is stored; the refetch at the end shows the row as the database has it.
    }
  } finally {
    progress.clear(row.id);
  }
}

// ---------------------------------------------------------------------------
// The optimistic insert (TanStack mutation)
// ---------------------------------------------------------------------------

type InsertVariables = { row: BoardItem; position: Promise<string> };

function useInsertItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["capture"],
    mutationFn: async ({ row, position }: InsertVariables) => {
      const finalPosition = await position;
      if (finalPosition !== row.position)
        patchCaches(queryClient, row.id, { position: finalPosition });
      const { error } = await createClient()
        .from("items")
        .insert({ ...row, position: finalPosition });
      if (error) throw error;
    },
    onMutate: async ({ row }) => {
      // A fetch that started before the insert would overwrite the card with older data.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["items"] }),
        queryClient.cancelQueries({ queryKey: ["counts"] }),
      ]);
      insertIntoCaches(queryClient, row);
    },
    onError: (error, { row }) => {
      // Take out exactly this card (a snapshot restore would also undo other captures in flight).
      removeFromCaches(queryClient, row);
      toast.error(
        isGuestQuotaError(error) ? GUEST_QUOTA_COPY : `Couldn't save ${row.file_name ?? "that"}.`,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function collectionName(queryClient: QueryClient, collectionId: string): string {
  const collections = queryClient.getQueryData<SidebarCollection[]>(["collections"]);
  return collections?.find((collection) => collection.id === collectionId)?.name ?? "collection";
}

/** Tells the user where a capture went when the current view does not show it. */
function announceDestination(deps: FlowDeps, row: BoardItem): void {
  if (itemMatchesView(row, deps.view)) return;
  const destination: ViewSpec = row.collection_id
    ? { type: "collection", collectionId: row.collection_id }
    : { type: "inbox" };
  const name = row.collection_id ? collectionName(deps.queryClient, row.collection_id) : "Inbox";
  toast(`Saved to ${name}`, {
    action: { label: "Open", onClick: () => deps.navigate(viewHref(destination)) },
  });
}

async function retryLink({ client, queryClient }: EnrichDeps, item: BoardItem): Promise<void> {
  const deps = { client, queryClient };
  if (!item.url || enriching.has(item.id)) return;
  enriching.add(item.id);
  inFlight += 1;
  try {
    try {
      await patchItem(deps, item.id, { enrich_status: "pending" });
    } catch {
      // Not fatal: the unfurl below decides the final state.
    }
    await enrichLink(deps, { id: item.id, url: item.url, kind: item.kind });
  } finally {
    enriching.delete(item.id);
    inFlight -= 1;
  }
  await refreshLists(queryClient);
}

/** Retry for a link whose details could not be fetched. Files cannot be retried after a reload. */
export function useRetryEnrich(): (item: BoardItem) => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    (item: BoardItem) => retryLink({ client: createClient(), queryClient }, item),
    [queryClient],
  );
}

export function useCapture(view: ViewSpec): {
  captureLink(url: string, options?: CanvasCaptureOptions): Promise<void>;
  /** Resolves with the saved item, or null when nothing was saved. */
  captureNote(text: string, options?: NoteOptions): Promise<BoardItem | null>;
  captureFile(file: File, options?: CanvasCaptureOptions): Promise<void>;
  captureText(text: string): Promise<void>;
  retryEnrich(item: BoardItem): Promise<void>;
} {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { userId, isGuest } = useViewer();
  const { mutateAsync: insert } = useInsertItem();
  const retryEnrich = useRetryEnrich();
  // A string, so callers that build `view` inline do not rebuild the callbacks every render.
  const currentViewKey = viewKey(view);

  return useMemo(() => {
    const currentView = viewFromKey(currentViewKey) ?? { type: "inbox" };
    const target = captureTargetFor(currentView);
    const makeDeps = (): FlowDeps => ({
      client: createClient(),
      queryClient,
      userId,
      isGuest,
      view: currentView,
      navigate: (href) => router.push(href),
    });
    const baseFor = (): RowBase => ({
      id: crypto.randomUUID(),
      userId,
      collectionId: target.collectionId,
      now: new Date().toISOString(),
    });

    /**
     * Insert the row (the card appears at once), then enrich it. One refetch at the very end,
     * so it cannot race the enrichment patch.
     */
    async function run(
      deps: FlowDeps,
      row: BoardItem,
      enrich: (() => Promise<void>) | null,
      tagNames: readonly string[] = [],
    ): Promise<boolean> {
      const position = reservePosition(deps.client);
      position.catch(() => undefined);

      inFlight += 1;
      let saved = false;
      try {
        try {
          await insert({ row, position });
          saved = true;
        } catch {
          // onError already removed the card and showed the toast.
        }

        if (saved) {
          announceDestination(deps, row);
          // The item row exists now, so `item_tags` can reference it.
          await attachTagNames(deps.client, queryClient, row.id, tagNames);
          if (enrich) {
            enriching.add(row.id);
            try {
              await enrich();
            } catch {
              // Enrichment reports its own failures; a capture never rejects.
            } finally {
              enriching.delete(row.id);
            }
          }
        }
      } finally {
        inFlight -= 1;
      }
      // Only the last capture to finish refetches (see `inFlight`).
      await refreshLists(queryClient);
      return saved;
    }

    async function captureLink(url: string, options?: CanvasCaptureOptions): Promise<void> {
      const deps = makeDeps();
      const row = atCanvasPoint(buildLinkRow(baseFor(), url), options?.canvasAt);
      await run(deps, row, () => enrichLink(deps, { id: row.id, url, kind: row.kind }));
    }

    async function captureNote(text: string, options?: NoteOptions): Promise<BoardItem | null> {
      if (text.trim() === "" && !options?.allowEmpty) return null;
      const row = atCanvasPoint(buildNoteRow(baseFor(), text, options?.title), options?.canvasAt);
      const saved = await run(makeDeps(), row, null, options?.tagNames ?? []);
      return saved ? row : null;
    }

    async function captureFile(file: File, options?: CanvasCaptureOptions): Promise<void> {
      const tooBig = checkFileSize(file.size, { isGuest });
      if (tooBig) {
        toast.error(uploadErrorMessage(tooBig.code, file.name));
        return;
      }
      const deps = makeDeps();
      const row = atCanvasPoint(buildFileRow(baseFor(), file), options?.canvasAt);
      await run(deps, row, () =>
        enrichFile(deps, row, file, () => void captureFile(file, options)),
      );
    }

    async function captureText(text: string): Promise<void> {
      const url = parseUrlInput(text);
      if (url) await captureLink(url);
      else await captureNote(text);
    }

    return { captureLink, captureNote, captureFile, captureText, retryEnrich };
  }, [currentViewKey, queryClient, router, userId, isGuest, insert, retryEnrich]);
}

export { UploadError };
