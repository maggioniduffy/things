import type { AdminClient } from "@/lib/supabase/admin";

const BUCKET = "things";
const DAY_MS = 24 * 60 * 60 * 1000;

export const TRASH_RETENTION_DAYS = 30;
export const UNFURL_LOG_RETENTION_HOURS = 24;
const BATCH_SIZE = 100;
// 20 batches x 100 items per run keeps a run well inside the function time limit; the rest waits for tomorrow.
const MAX_BATCHES = 20;

export type PurgeTrashResult = { purgedItems: number; removedObjects: number };

type Candidate = { id: string; file_path: string | null; thumbnail_path: string | null };

function pathsOf(item: Candidate): string[] {
  return [item.file_path, item.thumbnail_path].filter((path): path is string => !!path);
}

async function removeObjects(admin: AdminClient, paths: string[]): Promise<number | null> {
  if (paths.length === 0) return 0;
  const { data, error } = await admin.storage.from(BUCKET).remove(paths);
  if (error) return null;
  return data?.length ?? 0;
}

/**
 * Permanently deletes items trashed more than 30 days ago.
 * Storage objects go first; a row is deleted only when its objects are gone (or it has none),
 * so a failed storage call leaves the row for the next run instead of orphaning files.
 */
export async function purgeTrash(
  admin: AdminClient,
  now: Date = new Date(),
): Promise<PurgeTrashResult> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS).toISOString();
  let purgedItems = 0;
  let removedObjects = 0;
  let failedItems = 0;
  // Keyset cursor: rows kept after a storage failure are not re-selected within this run.
  let lastId: string | null = null;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    let query = admin
      .from("items")
      .select("id, file_path, thumbnail_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);
    if (lastId) query = query.gt("id", lastId);

    const { data: items, error } = await query;
    if (error) throw new Error("purge_select_failed");
    if (!items || items.length === 0) break;
    lastId = items[items.length - 1]?.id ?? lastId;

    // Try the whole batch in one storage call; if it fails, isolate the failing item(s).
    const deletable: string[] = [];
    const batchPaths = items.flatMap(pathsOf);
    const batchRemoved = await removeObjects(admin, batchPaths);
    if (batchRemoved !== null) {
      removedObjects += batchRemoved;
      deletable.push(...items.map((item) => item.id));
    } else {
      for (const item of items) {
        const removed = await removeObjects(admin, pathsOf(item));
        if (removed === null) {
          failedItems++;
          continue;
        }
        removedObjects += removed;
        deletable.push(item.id);
      }
    }

    if (deletable.length > 0) {
      // Re-check the cutoff so an item restored since the select is not deleted.
      const { data: deleted, error: deleteError } = await admin
        .from("items")
        .delete()
        .in("id", deletable)
        .not("deleted_at", "is", null)
        .lt("deleted_at", cutoff)
        .select("id");
      if (deleteError) throw new Error("purge_delete_failed");
      purgedItems += deleted?.length ?? 0;
    }

    if (items.length < BATCH_SIZE) break;
  }

  if (failedItems > 0)
    console.error(`cron: ${failedItems} trashed item(s) kept, storage removal failed`);
  return { purgedItems, removedObjects };
}

/** Deletes `unfurl_log` rows older than 24 hours (they only back the hourly rate limit). */
export async function purgeUnfurlLog(admin: AdminClient, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(
    now.getTime() - UNFURL_LOG_RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { count, error } = await admin
    .from("unfurl_log")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) throw new Error("unfurl_log_purge_failed");
  return count ?? 0;
}
