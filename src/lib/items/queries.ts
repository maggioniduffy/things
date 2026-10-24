import { infiniteQueryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Item } from "@/types/supabase";
import {
  applyRules,
  isRuleEmbedKey,
  parseRules,
  ruleSelect,
  viewToSearchRules,
  type Rules,
} from "@/lib/filters";
import { mergeSearchRules, type BoardSearch } from "@/lib/search-params";
import { viewKey, type SortMode, type ViewSpec } from "@/lib/views";
import { searchItems } from "./search";

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
  "color",
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

/**
 * The sort a view really uses. Smart views are filters, not places: they have no manual order, so
 * "manual" (the URL default) shows newest first there.
 */
export function effectiveSort(view: ViewSpec, sort: SortMode): SortMode {
  return view.type === "smart" && sort === "manual" ? "newest" : sort;
}

/** Key shared by the server prefetch and the browser: ["items", viewKey, sort]. */
export function itemsQueryKey(
  view: ViewSpec,
  sort: SortMode,
): readonly ["items", string, SortMode] {
  return ["items", viewKey(view), effectiveSort(view, sort)] as const;
}

/** Key of a search in a view: the plain key plus a `{ search }` segment, still under ["items"]. */
export function itemsSearchQueryKey(view: ViewSpec, sort: SortMode, search: BoardSearch) {
  return [...itemsQueryKey(view, sort), { search }] as const;
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

// Row shape when the tag view (or a smart view's tag rules) embeds item_tags for the inner join.
type RowWithJoin = BoardItem & { item_tags?: unknown; [embed: string]: unknown };

function stripJoin(row: RowWithJoin): BoardItem {
  const item: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key !== "item_tags" && !isRuleEmbedKey(key)) item[key] = value;
  }
  return item as BoardItem;
}

/** The rules of a smart view, or null when it no longer exists (RLS hides other users' views). */
async function fetchSmartViewRules(client: Client, viewId: string): Promise<Rules | null> {
  const { data, error } = await client
    .from("smart_views")
    .select("rules")
    .eq("id", viewId)
    .maybeSingle();
  if (error) throw error;
  return data ? parseRules(data.rules).rules : null;
}

/** Fetches one page (`limit` rows, PAGE_SIZE by default) of a view in the given sort, after `cursor`. */
export async function fetchItemsPage(
  client: Client,
  view: ViewSpec,
  sort: SortMode,
  cursor: ItemsCursor | null,
  limit: number = PAGE_SIZE,
): Promise<ItemsPage> {
  sort = effectiveSort(view, sort);

  let rules: Rules | null = null;
  if (view.type === "smart") {
    rules = await fetchSmartViewRules(client, view.viewId);
    if (!rules) return { items: [], nextCursor: null };
  }

  const columns =
    view.type === "tag"
      ? `${ITEM_COLUMNS},item_tags!inner(tag_id)`
      : rules
        ? ruleSelect(ITEM_COLUMNS, rules)
        : ITEM_COLUMNS;
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
    case "smart":
      if (rules) query = applyRules(query, rules);
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
    .limit(limit + 1)
    .overrideTypes<RowWithJoin[], { merge: false }>();
  if (error) throw error;

  const rows = data.map(stripJoin);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor: ItemsCursor | null =
    hasMore && last ? { value: sortValue(last, sort), id: last.id } : null;

  return { items, nextCursor };
}

/**
 * One ranked page of a search inside `view` (the view's rules plus the chips), through the
 * `search_items` RPC. No cursor: the RPC returns at most `SEARCH_LIMIT` rows in rank order.
 */
async function fetchSearchPage(
  client: Client,
  view: ViewSpec,
  search: BoardSearch,
): Promise<ItemsPage> {
  let smartRules: Rules | undefined;
  if (view.type === "smart") {
    const rules = await fetchSmartViewRules(client, view.viewId);
    if (!rules) return { items: [], nextCursor: null };
    smartRules = rules;
  }
  const rules = mergeSearchRules(viewToSearchRules(view, smartRules), search);
  if (rules === "empty") return { items: [], nextCursor: null };
  return { items: await searchItems(client, search.q, rules), nextCursor: null };
}

/** Pass `search` (from `parseSearchParams`) to list ranked matches instead of the plain view. */
export function itemsInfiniteQueryOptions(
  client: Client,
  view: ViewSpec,
  sort: SortMode,
  search?: BoardSearch | null,
) {
  return infiniteQueryOptions({
    queryKey: search ? itemsSearchQueryKey(view, sort, search) : itemsQueryKey(view, sort),
    queryFn: ({ pageParam }): Promise<ItemsPage> =>
      search
        ? fetchSearchPage(client, view, search)
        : fetchItemsPage(client, view, sort, pageParam),
    initialPageParam: null as ItemsCursor | null,
    getNextPageParam: (lastPage: ItemsPage) => lastPage.nextCursor ?? undefined,
  });
}
