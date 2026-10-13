import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRules, type Rules } from "@/lib/filters";
import type { Database } from "@/types/supabase";
import { summarizeCounts, type SidebarCounts } from "./counts";

type Client = SupabaseClient<Database>;

export type SidebarCollection = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  position: string;
};
export type SidebarTag = { id: string; name: string; color: string | null };
export type SidebarSmartView = {
  id: string;
  name: string;
  icon: string | null;
  position: string;
  /** The saved filters (the empty rules when the stored JSON is not valid). */
  rules: Rules;
  /** The stored rules could not be read; `rules` is the empty set. */
  invalidRules?: boolean;
};

export function countsQueryOptions(client: Client) {
  return queryOptions({
    queryKey: ["counts"] as const,
    queryFn: async (): Promise<SidebarCounts> => {
      const { data, error } = await client
        .from("item_counts")
        .select("kind,collection_id,is_read,is_favorite,archived,deleted,n");
      if (error) throw error;
      return summarizeCounts(data);
    },
  });
}

export function collectionsQueryOptions(client: Client) {
  return queryOptions({
    queryKey: ["collections"] as const,
    queryFn: async (): Promise<SidebarCollection[]> => {
      const { data, error } = await client
        .from("collections")
        .select("id,name,emoji,color,position")
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function tagsQueryOptions(client: Client) {
  return queryOptions({
    queryKey: ["tags"] as const,
    queryFn: async (): Promise<SidebarTag[]> => {
      const { data, error } = await client
        .from("tags")
        .select("id,name,color")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function smartViewsQueryOptions(client: Client) {
  return queryOptions({
    queryKey: ["smart-views"] as const,
    queryFn: async (): Promise<SidebarSmartView[]> => {
      const { data, error } = await client
        .from("smart_views")
        .select("id,name,icon,position,rules")
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data.map(({ rules, ...row }) => {
        const parsed = parseRules(rules);
        return parsed.invalid
          ? { ...row, rules: parsed.rules, invalidRules: true }
          : { ...row, rules: parsed.rules };
      });
    },
  });
}
