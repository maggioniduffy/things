import type { AdminClient } from "@/lib/supabase/admin";

const BUCKET = "things";
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimum age of an orphan before it is removed, so in-flight uploads are never killed. */
export const ORPHAN_MIN_AGE_MS = DAY_MS;
/** Max objects removed per run. */
export const MAX_ORPHAN_OBJECTS = 1000;
/** Max `{user}/{item}/` folders examined per run. */
export const MAX_FOLDERS_SCANNED = 2000;

type Entry = { name: string; id: string | null; created_at: string | null };

/** All sub-folders of `prefix` (entries with a null id), paged, up to `max`. */
async function listFolders(admin: AdminClient, prefix: string, max: number): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; names.length < max; offset += PAGE) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("orphan_list_failed");
    const entries: Entry[] = data ?? [];
    for (const entry of entries) {
      if (entry.id === null && UUID.test(entry.name)) names.push(entry.name);
    }
    if (entries.length < PAGE) break;
  }
  return names.slice(0, max);
}

/**
 * Removes objects under `{user_id}/{item_id}/` whose item id has no `items` row and that are
 * older than a day. Bounded per run; the rest is picked up on later runs.
 * Returns the number of objects removed.
 */
export async function sweepOrphans(admin: AdminClient, now: Date = new Date()): Promise<number> {
  const youngerThan = now.getTime() - ORPHAN_MIN_AGE_MS;
  let removed = 0;
  let scanned = 0;

  // Folders are listed before anything is removed: deleting while paging by offset would skip entries.
  const users = await listFolders(admin, "", MAX_FOLDERS_SCANNED);

  for (const user of users) {
    if (removed >= MAX_ORPHAN_OBJECTS || scanned >= MAX_FOLDERS_SCANNED) break;

    const items = await listFolders(admin, user, MAX_FOLDERS_SCANNED - scanned);
    scanned += items.length;

    for (let i = 0; i < items.length; i += PAGE) {
      const chunk = items.slice(i, i + PAGE);
      const { data: rows, error } = await admin.from("items").select("id").in("id", chunk);
      if (error) throw new Error("orphan_select_failed");
      const known = new Set((rows ?? []).map((row) => row.id));

      for (const item of chunk) {
        if (known.has(item)) continue;
        const room = MAX_ORPHAN_OBJECTS - removed;
        if (room <= 0) return removed;

        const folder = `${user}/${item}`;
        const { data: files, error: listError } = await admin.storage
          .from(BUCKET)
          .list(folder, { limit: room, sortBy: { column: "name", order: "asc" } });
        if (listError) throw new Error("orphan_list_failed");

        const objects = ((files ?? []) as Entry[]).filter((file) => file.id !== null);
        if (objects.length === 0) continue;
        // One recent (or undated) object means an upload may still be in flight: leave the folder alone.
        const settled = objects.every(
          (file) => file.created_at !== null && new Date(file.created_at).getTime() <= youngerThan,
        );
        if (!settled) continue;

        const { data: gone, error: removeError } = await admin.storage
          .from(BUCKET)
          .remove(objects.map((file) => `${folder}/${file.name}`));
        if (removeError) {
          console.error("cron: orphan folder removal failed");
          continue;
        }
        removed += gone?.length ?? 0;
      }
    }
  }
  return removed;
}
