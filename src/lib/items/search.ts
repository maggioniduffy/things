import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/types/database.types";
import type { Database } from "@/types/supabase";
import { cleanSearchRules, type SearchRules } from "@/lib/filters";
import { ITEM_COLUMNS, type BoardItem } from "./queries";

type Client = SupabaseClient<Database>;

/** The most rows one search returns (the RPC caps `lim` at the same value). */
export const SEARCH_LIMIT = 200;

/**
 * Ranked search through the `search_items` RPC: full text plus typo-tolerant title match, under
 * RLS. `rules` are cleaned first, so blank or malformed filters never reach the database.
 */
export async function searchItems(
  client: Client,
  q: string,
  rules: SearchRules,
  lim: number = SEARCH_LIMIT,
): Promise<BoardItem[]> {
  const { data, error } = await client
    .rpc("search_items", { q, rules: cleanSearchRules(rules) as Json, lim })
    .select(ITEM_COLUMNS);
  if (error) throw error;
  return (data ?? []) as unknown as BoardItem[];
}
