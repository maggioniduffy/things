"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback } from "react";
import { toast } from "sonner";
import { getActiveMessages } from "@/i18n/active";
import { useViewer } from "@/components/providers/viewer-provider";
import { undoToast } from "@/components/ui/sonner";
import { snapPoint, type CanvasTarget } from "@/lib/canvas/layout";
import { createClient } from "@/lib/supabase/client";
import type { CanvasClipboard } from "@/stores/canvas-clipboard";
import type { Database } from "@/types/supabase";
import {
  guestQuotaToast,
  reservePositions,
  insertIntoCaches,
  isGuestQuotaError,
  removeFromCaches,
  withInFlightWrite,
} from "./mutations";
import type { BoardItem } from "./queries";
import { ITEM_COLUMNS } from "./queries";
import { storagePathsOf } from "./state-mutations";
import { BUCKET, filePath, thumbnailPath } from "./upload";

type Client = SupabaseClient<Database>;

/** A duplicate sits this far (flow units) down and to the right of its original. */
export const DUPLICATE_OFFSET = 16;

// ---------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------

/** A card on screen, as far as copying is concerned. */
export type CopiedCard = { item: BoardItem; x: number; y: number; w: number; h: number };

const untitled = (): string => getActiveMessages().items.untitled;

/** One line of the system-clipboard text: URL for links, note text for notes, a name for files. */
export function copyLine(item: BoardItem): string {
  const first = (...values: (string | null)[]): string | null =>
    values.map((value) => value?.trim() ?? "").find((value) => value !== "") ?? null;
  if (item.kind === "note") return first(item.note, item.title) ?? untitled();
  if (item.file_path) return first(item.title, item.file_name) ?? untitled();
  return first(item.url, item.title, item.file_name) ?? untitled();
}

/** The in-app clipboard for `cards` (in the order given): offsets from their bounding box. */
export function buildClipboard(cards: readonly CopiedCard[]): CanvasClipboard | null {
  if (cards.length === 0) return null;
  const left = Math.min(...cards.map((card) => card.x));
  const top = Math.min(...cards.map((card) => card.y));
  const right = Math.max(...cards.map((card) => card.x + card.w));
  const bottom = Math.max(...cards.map((card) => card.y + card.h));
  return {
    entries: cards.map((card) => ({ id: card.item.id, dx: card.x - left, dy: card.y - top })),
    text: cards.map((card) => copyLine(card.item)).join("\n"),
    width: right - left,
    height: bottom - top,
  };
}

/** Where one copy goes: the top-left corner of its card. */
export type Placement = { id: string; x: number; y: number };

/**
 * A paste: the copies' bounding box centered on `point`, each card at its stored offset. With
 * `point.snap` the box's top-left corner is on the grid, so the cards keep their offsets.
 */
export function pastePlacements(clipboard: CanvasClipboard, point: CanvasTarget): Placement[] {
  const centered = { x: point.x - clipboard.width / 2, y: point.y - clipboard.height / 2 };
  const { x: left, y: top } = point.snap ? snapPoint(centered) : centered;
  return clipboard.entries.map((entry) => ({
    id: entry.id,
    x: left + entry.dx,
    y: top + entry.dy,
  }));
}

/** A duplicate: every card 16 px down and right of where it is. */
export function duplicatePlacements(cards: readonly CopiedCard[]): Placement[] {
  return cards.map((card) => ({
    id: card.item.id,
    x: card.x + DUPLICATE_OFFSET,
    y: card.y + DUPLICATE_OFFSET,
  }));
}

export type CopySource = { item: BoardItem; tagIds: readonly string[]; x: number; y: number };

export type CopyRowOptions = {
  userId: string;
  /** The collection of the canvas the copies land on (null = Inbox). */
  collectionId: string | null;
  /** Stack level of the first copy; later copies stack one above each other. */
  z: number;
  now: string;
  newId?: () => string;
};

export type CopyRows = {
  rows: BoardItem[];
  tags: { item_id: string; tag_id: string; user_id: string }[];
  /** Storage objects to duplicate, `from` -> `to` (bucket not included). */
  files: { from: string; to: string }[];
};

/** The rows (and tag links, and storage copies) that duplicate `sources`, in the order given. */
export function buildCopyRows(
  sources: readonly CopySource[],
  positions: readonly string[],
  options: CopyRowOptions,
): CopyRows {
  const { userId, collectionId, z, now } = options;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const rows: BoardItem[] = [];
  const tags: CopyRows["tags"] = [];
  const files: CopyRows["files"] = [];

  sources.forEach((source, index) => {
    const { item } = source;
    const id = newId();
    const path = item.file_path ? filePath(userId, id, item.file_name ?? "file") : null;
    const thumb = item.thumbnail_path ? thumbnailPath(userId, id) : null;
    if (item.file_path && path) files.push({ from: item.file_path, to: path });
    if (item.thumbnail_path && thumb) files.push({ from: item.thumbnail_path, to: thumb });

    rows.push({
      ...item,
      id,
      user_id: userId,
      collection_id: collectionId,
      position: positions[index] ?? "a0",
      canvas_x: source.x,
      canvas_y: source.y,
      canvas_z: z + index,
      is_read: false,
      is_favorite: false,
      archived_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      file_path: path,
      thumbnail_path: thumb,
    });
    for (const tagId of source.tagIds) tags.push({ item_id: id, tag_id: tagId, user_id: userId });
  });
  return { rows, tags, files };
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

function isQuotaFailure(error: unknown): boolean {
  if (isGuestQuotaError(error)) return true;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && /P0001|quota/i.test(message);
}

async function removeObjects(client: Client, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  await client.storage
    .from(BUCKET)
    .remove([...paths])
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Hard-deletes copies (rows first, then storage objects), with the cards leaving the lists at once. */
async function deleteCopies(
  client: Client,
  queryClient: QueryClient,
  rows: readonly BoardItem[],
): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ["items"] }),
    queryClient.cancelQueries({ queryKey: ["counts"] }),
  ]);
  for (const row of rows) removeFromCaches(queryClient, row);
  try {
    // Rows first: a failed delete then leaves whole cards, not cards whose files are gone.
    const { error } = await client
      .from("items")
      .delete()
      .in(
        "id",
        rows.map((row) => row.id),
      );
    if (error) throw error;
    const removed = await client.storage
      .from(BUCKET)
      .remove(rows.flatMap((row) => storagePathsOf(row)));
    if (removed.error) throw removed.error;
  } catch {
    toast.error(getActiveMessages().items.toasts.errUndo);
  }
}

export type CopyRequest = {
  placements: readonly Placement[];
  /** Stack level for the first copy. */
  z: number;
  verb: "pasted" | "duplicated";
  /** Called with the new ids once they are known, before the cards reach the lists. */
  onCreated?: (ids: string[]) => void;
};

/**
 * Pastes or duplicates cards onto the canvas of `collectionId` (null = Inbox): one optimistic
 * insert, one batch insert in the database, one Undo toast. Resolves with the new ids ([] when
 * nothing was saved).
 */
export function usePasteCopies(
  collectionId: string | null,
): (request: CopyRequest) => Promise<string[]> {
  const queryClient = useQueryClient();
  const { userId } = useViewer();

  return useCallback(
    (request: CopyRequest) =>
      withInFlightWrite(queryClient, async () => {
        const client = createClient();
        const ids = request.placements.map((placement) => placement.id);

        // Read the sources now, so a paste works from another canvas and skips deleted cards.
        let built: CopyRows;
        try {
          const [items, tagLinks] = await Promise.all([
            client
              .from("items")
              .select(ITEM_COLUMNS)
              .in("id", ids)
              .is("deleted_at", null)
              .returns<BoardItem[]>(),
            client.from("item_tags").select("item_id,tag_id").in("item_id", ids),
          ]);
          if (items.error) throw items.error;
          if (tagLinks.error) throw tagLinks.error;
          const byId = new Map(items.data.map((item) => [item.id, item]));
          const sources: CopySource[] = [];
          for (const placement of request.placements) {
            const item = byId.get(placement.id);
            if (!item) continue;
            sources.push({
              item,
              x: placement.x,
              y: placement.y,
              tagIds: tagLinks.data
                .filter((link) => link.item_id === item.id)
                .map((link) => link.tag_id),
            });
          }
          if (sources.length === 0) {
            toast(getActiveMessages().items.toasts.nothingToPaste);
            return [];
          }
          // Reserved once the sources are known, so the count is exact and no key goes unused.
          const positions = await reservePositions(client, sources.length);
          built = buildCopyRows(sources, positions, {
            userId,
            collectionId,
            z: request.z,
            now: new Date().toISOString(),
          });
        } catch {
          toast.error(getActiveMessages().items.toasts.errPaste);
          return [];
        }

        const { rows, tags, files } = built;
        const newIds = rows.map((row) => row.id);
        request.onCreated?.(newIds);

        // A fetch that started before the insert would overwrite the cards with older data.
        await Promise.all([
          queryClient.cancelQueries({ queryKey: ["items"] }),
          queryClient.cancelQueries({ queryKey: ["counts"] }),
        ]);
        // Prepending in reverse leaves the first copy on top, matching its grid position.
        for (const row of [...rows].reverse()) insertIntoCaches(queryClient, row);

        const copied: string[] = [];
        let inserted = false;
        try {
          const results = await Promise.all(
            files.map(async (file) => {
              const { error } = await client.storage.from(BUCKET).copy(file.from, file.to);
              if (!error) copied.push(file.to);
              return error;
            }),
          );
          const failure = results.find((error) => error != null);
          if (failure) throw failure;

          const insert = await client.from("items").insert(rows);
          if (insert.error) throw insert.error;
          inserted = true;

          if (tags.length > 0) {
            const linked = await client.from("item_tags").insert(tags);
            if (linked.error) throw linked.error;
          }
        } catch (error) {
          for (const row of rows) removeFromCaches(queryClient, row);
          // Keep the files if the rows could not be removed: they still point at them.
          const kept = inserted && (await client.from("items").delete().in("id", newIds)).error;
          if (!kept) await removeObjects(client, copied);
          const msgs = getActiveMessages().items.toasts;
          if (isQuotaFailure(error)) guestQuotaToast();
          else toast.error(msgs.errPaste);
          return [];
        }

        undoToast(
          getActiveMessages().items.toasts[request.verb](rows.length),
          () => void withInFlightWrite(queryClient, () => deleteCopies(client, queryClient, rows)),
        );
        return newIds;
      }),
    [queryClient, userId, collectionId],
  );
}
