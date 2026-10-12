import { infiniteQueryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Item } from "@/types/supabase";
import { viewKey, type SortMode, type ViewSpec } from "@/lib/views";

type Client = SupabaseClient<Database>;

export const PAGE_SIZE = 50;

/** An items row without the generated `search` tsvector (never needed in the browser). */
export type BoardItem = Omit<Item, "search">;

const ITEM_COLUMN_LIST = [
  "archived_at",
  "canvas_h",
  "canvas_w",
  "canvas_x",
  "canvas_y",
  "canvas_z",
  "collection_id",
  "created_at",
  "deleted_at",
  "description",
  "domain",
  "enrich_status",
  "favicon_url",
  "file_name",
  "file_path",
  "file_size",
  "id",
  "image_url",
  "is_favorite",
  "is_read",
  "kind",
  "metadata",
  "mime_type",
  "note",
  "position",
  "site_name",
  "thumbnail_path",
  "title",
  "updated_at",
  "url",
  "user_id",
] as const satisfies readonly (keyof BoardItem)[];

// Compile-time exhaustiveness: fails if the items table gains a column this list lacks.
type MissingColumns = Exclude<keyof BoardItem, (typeof ITEM_COLUMN_LIST)[number]>;
const _allColumnsListed: [MissingColumns] extends [never] ? true : never = true;
void _allColumnsListed;

/** Explicit select list: every items column except `search`. */
export const ITEM_COLUMNS: string = ITEM_COLUMN_LIST.join(",");

/** Last returned row's sort value + id. `value` is null only in the title sort's null tail. */
export type ItemsCursor = { value: string | null; id: string };

export type ItemsPage = { items: BoardItem[]; nextCursor: ItemsCursor | null };

/** Key shared by the server prefetch and the browser: ["items", viewKey, sort]. */
export function itemsQueryKey(
  view: ViewSpec,
  sort: SortMode,
): readonly ["items", string, SortMode] {
  return ["items", viewKey(view), sort] as const;
}

/**
 * Quotes a value for a PostgREST logical filter (`or=(...)`): wraps it in double quotes and
 * backslash-escapes `\` and `"`, so `,` `(` `)` `.` and friends cannot break the syntax.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

type SortColumn = "position" | "created_at" | "title";

const SORT_COLUMN: Record<SortMode, SortColumn> = {
  manual: "position",
  newest: "created_at",
  oldest: "created_at",
  title: "title",
};

function sortValue(row: BoardItem, sort: SortMode): string | null {
  return row[SORT_COLUMN[sort]];
}

// Row shape when the tag view embeds item_tags for the inner join.
type RowWithJoin = BoardItem & { item_tags?: unknown };

function stripJoin(row: RowWithJoin): BoardItem {
  const { item_tags: _joined, ...item } = row;
  void _joined;
  return item;
}

/** Fetches one page (PAGE_SIZE rows) of a view in the given sort, after `cursor`. */
export async function fetchItemsPage(
  client: Client,
  view: ViewSpec,
  sort: SortMode,
  cursor: ItemsCursor | null,
): Promise<ItemsPage> {
  // Smart views arrive in WP 5.4: empty without a request.
  if (view.type === "smart") return { items: [], nextCursor: null };

  const columns = view.type === "tag" ? `${ITEM_COLUMNS},item_tags!inner(tag_id)` : ITEM_COLUMNS;
  let query = client.from("items").select(columns);

  // View filters. RLS scopes rows to the user, so there is no user_id filter.
  switch (view.type) {
    case "inbox":
      query = query.is("deleted_at", null).is("archived_at", null).is("collection_id", null);
      break;
    case "all":
      query = query.is("deleted_at", null).is("archived_at", null);
      break;
    case "unread":
      query = query.is("deleted_at", null).is("archived_at", null).eq("is_read", false);
      break;
    case "favorites":
      query = query.is("deleted_at", null).is("archived_at", null).eq("is_favorite", true);
      break;
    case "archive":
      query = query.is("deleted_at", null).not("archived_at", "is", null);
      break;
    case "trash":
      query = query.not("deleted_at", "is", null);
      break;
    case "kind":
      query = query.is("deleted_at", null).is("archived_at", null).eq("kind", view.kind);
      break;
    case "collection":
      query = query
        .is("deleted_at", null)
        .is("archived_at", null)
        .eq("collection_id", view.collectionId);
      break;
    case "tag":
      query = query
        .is("deleted_at", null)
        .is("archived_at", null)
        .eq("item_tags.tag_id", view.tagId);
      break;
  }

  // Keyset condition + order.
  switch (sort) {
    case "manual":
      if (cursor?.value != null) {
        const v = quotePostgrestValue(cursor.value);
        const id = quotePostgrestValue(cursor.id);
        query = query.or(`position.gt.${v},and(position.eq.${v},id.gt.${id})`);
      }
      query = query.order("position", { ascending: true }).order("id", { ascending: true });
      break;
    case "newest":
      if (cursor?.value != null) {
        const v = quotePostgrestValue(cursor.value);
        const id = quotePostgrestValue(cursor.id);
        query = query.or(`created_at.lt.${v},and(created_at.eq.${v},id.lt.${id})`);
      }
      query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
      break;
    case "oldest":
      if (cursor?.value != null) {
        const v = quotePostgrestValue(cursor.value);
        const id = quotePostgrestValue(cursor.id);
        query = query.or(`created_at.gt.${v},and(created_at.eq.${v},id.gt.${id})`);
      }
      query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
      break;
    case "title":
      if (cursor) {
        if (cursor.value === null) {
          // Already in the null tail: only later ids remain.
          query = query.is("title", null).gt("id", cursor.id);
        } else {
          const v = quotePostgrestValue(cursor.value);
          const id = quotePostgrestValue(cursor.id);
          query = query.or(`title.gt.${v},and(title.eq.${v},id.gt.${id}),title.is.null`);
        }
      }
      query = query
        .order("title", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
      break;
  }

  // One extra row tells us whether another page exists.
  const { data, error } = await query
    .limit(PAGE_SIZE + 1)
    .overrideTypes<RowWithJoin[], { merge: false }>();
  if (error) throw error;

  const rows = data.map(stripJoin);
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = items[items.length - 1];
  const nextCursor: ItemsCursor | null =
    hasMore && last ? { value: sortValue(last, sort), id: last.id } : null;

  return { items, nextCursor };
}

export function itemsInfiniteQueryOptions(client: Client, view: ViewSpec, sort: SortMode) {
  return infiniteQueryOptions({
    queryKey: itemsQueryKey(view, sort),
    queryFn: ({ pageParam }) => fetchItemsPage(client, view, sort, pageParam),
    initialPageParam: null as ItemsCursor | null,
    getNextPageParam: (lastPage: ItemsPage) => lastPage.nextCursor ?? undefined,
  });
}
