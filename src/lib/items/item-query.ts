import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/supabase";
import { ITEM_COLUMNS, type BoardItem } from "./queries";

type Client = SupabaseClient<Database>;

const uuidSchema = z.uuid();

/** Whether `value` can be an item id; anything else is never sent to the database. */
export function isItemId(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/** One item by id, or null when it does not exist or belongs to someone else (RLS hides it). */
export async function fetchItemById(client: Client, id: string): Promise<BoardItem | null> {
  if (!isItemId(id)) return null;
  const { data, error } = await client
    .from("items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle<BoardItem>();
  if (error) throw error;
  return data;
}

/** Key `["item", id]`: the detail drawer's copy of an item, kept in step by the state mutations. */
export function itemQueryKey(id: string) {
  return ["item", id] as const;
}

export function itemQueryOptions(client: Client, id: string) {
  return queryOptions({
    queryKey: itemQueryKey(id),
    queryFn: () => fetchItemById(client, id),
  });
}

/** Key `["item-tags", itemId]`: ids of the tags attached to an item. */
export function itemTagsQueryKey(itemId: string) {
  return ["item-tags", itemId] as const;
}

export function itemTagsQueryOptions(client: Client, itemId: string) {
  return queryOptions({
    queryKey: itemTagsQueryKey(itemId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await client.from("item_tags").select("tag_id").eq("item_id", itemId);
      if (error) throw error;
      return data.map((row) => row.tag_id);
    },
  });
}
