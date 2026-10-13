"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { itemTagsQueryKey } from "@/lib/items/item-query";
import type { SidebarTag } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { viewHref } from "@/lib/views";
import type { Database } from "@/types/supabase";
import { MAX_TAG_LENGTH } from "./parse";

type Client = SupabaseClient<Database>;

const TAGS_KEY = ["tags"] as const;
const TAG_COLUMNS = "id,name,color";
const UNIQUE_VIOLATION = "23505";

export const DUPLICATE_TAG_COPY = "You already have a tag with that name.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** A typed tag name as stored: no leading `#`, whitespace collapsed and trimmed. */
export function normalizeTagName(raw: string): string {
  return raw
    .replace(/^[\s#]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidTagName(name: string): boolean {
  return name !== "" && [...name].length <= MAX_TAG_LENGTH;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

/** The tag called `name`, ignoring case (the database index is on `lower(name)`). */
export function findTagByName(
  tags: readonly SidebarTag[],
  name: string,
  exceptId?: string,
): SidebarTag | undefined {
  const key = name.toLowerCase();
  return tags.find((tag) => tag.id !== exceptId && tag.name.toLowerCase() === key);
}

/** Sidebar order: by name. The refetch after a change settles any collation difference. */
function sortTags(tags: SidebarTag[]): SidebarTag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function cachedTags(queryClient: QueryClient): SidebarTag[] {
  return queryClient.getQueryData<SidebarTag[]>(TAGS_KEY) ?? [];
}

// ---------------------------------------------------------------------------
// Plain async helpers (no hooks): shared by the hooks and by capture
// ---------------------------------------------------------------------------

async function refetchTags(client: Client, queryClient: QueryClient): Promise<SidebarTag[]> {
  const { data, error } = await client
    .from("tags")
    .select(TAG_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  queryClient.setQueryData(TAGS_KEY, data);
  return data;
}

/**
 * The tags called `names` (trimmed, matched ignoring case), creating the missing ones with one
 * insert. The unique index is on `(user_id, lower(name))`, an expression PostgREST cannot upsert
 * on, so a `23505` (another tab got there first) refetches the tags and reuses the existing rows.
 * Invalid names are skipped; the result follows the order of `names`.
 */
export async function ensureTags(
  client: Client,
  queryClient: QueryClient,
  names: readonly string[],
): Promise<SidebarTag[]> {
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = normalizeTagName(raw);
    if (!isValidTagName(name) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    wanted.push(name);
  }
  if (wanted.length === 0) return [];

  let known = cachedTags(queryClient);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const missing = wanted.filter((name) => !findTagByName(known, name));
    if (missing.length === 0) break;

    const { data, error } = await client
      .from("tags")
      .insert(missing.map((name) => ({ id: crypto.randomUUID(), name })))
      .select(TAG_COLUMNS);
    if (!error) {
      known = sortTags([...cachedTags(queryClient), ...data]);
      queryClient.setQueryData(TAGS_KEY, known);
      continue;
    }
    if (!isUniqueViolation(error)) throw error;
    known = await refetchTags(client, queryClient);
  }

  const result: SidebarTag[] = [];
  for (const name of wanted) {
    const tag = findTagByName(known, name);
    if (!tag) throw new Error(`Tag "${name}" could not be created.`);
    result.push(tag);
  }
  return result;
}

/** One insert for all `item_tags` rows; rows that already exist are ignored. */
export async function attachTags(
  client: Client,
  itemId: string,
  tagIds: readonly string[],
): Promise<void> {
  if (tagIds.length === 0) return;
  const { error } = await client.from("item_tags").upsert(
    tagIds.map((tagId) => ({ item_id: itemId, tag_id: tagId })),
    { onConflict: "item_id,tag_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/**
 * Creates the missing tags and attaches all of them to an item that already exists in the
 * database, then refreshes what shows tags. Reports its own failure; never rejects.
 */
export async function attachTagNames(
  client: Client,
  queryClient: QueryClient,
  itemId: string,
  names: readonly string[],
): Promise<void> {
  if (names.length === 0) return;
  try {
    const tags = await ensureTags(client, queryClient, names);
    await attachTags(
      client,
      itemId,
      tags.map((tag) => tag.id),
    );
  } catch {
    toast.error("Couldn't add those tags.");
  } finally {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: itemTagsQueryKey(itemId) }),
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type TagManager = {
  /** Creates a tag, or returns the existing one with that name (any casing). Null when it failed. */
  create(name: string): Promise<SidebarTag | null>;
  /** True when the rename was applied. */
  rename(id: string, name: string): Promise<boolean>;
  /** Deletes the tag; its `item_tags` rows go with it. True when it was deleted. */
  remove(id: string): Promise<boolean>;
};

type Snapshot = { tags: SidebarTag[] | undefined };

/** Optimistic create / rename / delete of tags: apply to the cache at once, roll back on error. */
export function useTagManager(): TagManager {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  });

  const create = useMutation({
    mutationKey: ["tag-create"],
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<SidebarTag> => {
      const client = createClient();
      const { data, error } = await client
        .from("tags")
        .insert({ id, name })
        .select(TAG_COLUMNS)
        .single();
      if (!error) return data;
      if (!isUniqueViolation(error)) throw error;
      const existing = findTagByName(await refetchTags(client, queryClient), name);
      if (existing) return existing;
      throw error;
    },
    onMutate: async ({ id, name }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: TAGS_KEY });
      const tags = queryClient.getQueryData<SidebarTag[]>(TAGS_KEY);
      queryClient.setQueryData<SidebarTag[]>(TAGS_KEY, (current) =>
        sortTags([...(current ?? []), { id, name, color: null }]),
      );
      return { tags };
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) queryClient.setQueryData(TAGS_KEY, snapshot.tags);
      toast.error("Couldn't create that tag.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });

  const rename = useMutation({
    mutationKey: ["tag-rename"],
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const client = createClient();
      const { error } = await client.from("tags").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, name }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: TAGS_KEY });
      const tags = queryClient.getQueryData<SidebarTag[]>(TAGS_KEY);
      queryClient.setQueryData<SidebarTag[]>(TAGS_KEY, (current) =>
        current
          ? sortTags(current.map((tag) => (tag.id === id ? { ...tag, name } : tag)))
          : current,
      );
      return { tags };
    },
    onError: (error, _vars, snapshot) => {
      if (snapshot) queryClient.setQueryData(TAGS_KEY, snapshot.tags);
      toast.error(isUniqueViolation(error) ? DUPLICATE_TAG_COPY : "Couldn't rename that tag.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });

  const remove = useMutation({
    mutationKey: ["tag-remove"],
    mutationFn: async ({ id }: { id: string }) => {
      const client = createClient();
      const { error } = await client.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: TAGS_KEY }),
        queryClient.cancelQueries({ queryKey: ["item-tags"] }),
      ]);
      const tags = queryClient.getQueryData<SidebarTag[]>(TAGS_KEY);
      const itemTags = queryClient.getQueriesData<string[]>({ queryKey: ["item-tags"] });
      queryClient.setQueryData<SidebarTag[]>(TAGS_KEY, (current) =>
        current?.filter((tag) => tag.id !== id),
      );
      for (const [key, ids] of itemTags) {
        if (ids?.includes(id))
          queryClient.setQueryData(
            key,
            ids.filter((tagId) => tagId !== id),
          );
      }
      return { tags, itemTags };
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(TAGS_KEY, context.tags);
        for (const [key, ids] of context.itemTags) queryClient.setQueryData(key, ids);
      }
      toast.error("Couldn't delete that tag.");
    },
    onSuccess: (_data, { id }) => {
      if (pathnameRef.current === viewHref({ type: "tag", tagId: id })) router.push("/app");
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["item-tags"] }),
      ]),
  });

  const { mutateAsync: createAsync } = create;
  const { mutateAsync: renameAsync } = rename;
  const { mutateAsync: removeAsync } = remove;

  return useMemo<TagManager>(
    () => ({
      create: async (raw) => {
        const name = normalizeTagName(raw);
        if (!isValidTagName(name)) return null;
        const existing = findTagByName(cachedTags(queryClient), name);
        if (existing) return existing;
        try {
          return await createAsync({ id: crypto.randomUUID(), name });
        } catch {
          // onError already rolled back and showed the toast.
          return null;
        }
      },
      rename: async (id, raw) => {
        const name = normalizeTagName(raw);
        const current = cachedTags(queryClient).find((tag) => tag.id === id);
        if (!isValidTagName(name) || current?.name === name) return false;
        if (findTagByName(cachedTags(queryClient), name, id)) {
          toast.error(DUPLICATE_TAG_COPY);
          return false;
        }
        try {
          await renameAsync({ id, name });
          return true;
        } catch {
          return false;
        }
      },
      remove: async (id) => {
        try {
          await removeAsync({ id });
          return true;
        } catch {
          return false;
        }
      },
    }),
    [queryClient, createAsync, renameAsync, removeAsync],
  );
}
