"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { keyAfter } from "@/lib/order";
import type { SidebarCollection } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { viewHref } from "@/lib/views";
import { isAuroraColor, isValidCollectionName, normalizeCollectionName } from "./fields";

const COLLECTIONS_KEY = ["collections"] as const;

export type CollectionInput = {
  name: string;
  emoji?: string | null;
  /** An aurora token name, e.g. `aurora-violet`; anything else is stored as none. */
  color?: string | null;
};
export type CollectionPatch = Partial<CollectionInput>;

export type CollectionActions = {
  /** Appends a collection after the last one. Null when it failed (or the name is not valid). */
  create(input: CollectionInput): Promise<SidebarCollection | null>;
  /** True when the change was applied. */
  update(id: string, patch: CollectionPatch): Promise<boolean>;
  /** Items in it fall back to the Inbox (`on delete set null`). True when it was deleted. */
  remove(id: string): Promise<boolean>;
};

type Snapshot = { collections: SidebarCollection[] | undefined };

/** The position after every cached collection. */
function nextPosition(collections: readonly SidebarCollection[] | undefined): string {
  let last: string | null = null;
  for (const { position } of collections ?? []) {
    if (last === null || position > last) last = position;
  }
  return keyAfter(last);
}

/** A patch as stored: trimmed name, a color that is a known token or null. */
function cleanPatch(patch: CollectionPatch): Partial<Omit<SidebarCollection, "id" | "position">> {
  const clean: Partial<Omit<SidebarCollection, "id" | "position">> = {};
  if (patch.name !== undefined) clean.name = normalizeCollectionName(patch.name);
  if (patch.emoji !== undefined) clean.emoji = patch.emoji === "" ? null : patch.emoji;
  if (patch.color !== undefined) clean.color = isAuroraColor(patch.color) ? patch.color : null;
  return clean;
}

/** Optimistic create / update / delete of collections: apply to the cache at once, roll back on error. */
export function useCollectionActions(): CollectionActions {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  });

  const create = useMutation({
    mutationKey: ["collection-create"],
    mutationFn: async (row: SidebarCollection) => {
      const { error } = await createClient().from("collections").insert(row);
      if (error) throw error;
    },
    onMutate: async (row): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: COLLECTIONS_KEY });
      const collections = queryClient.getQueryData<SidebarCollection[]>(COLLECTIONS_KEY);
      queryClient.setQueryData<SidebarCollection[]>(COLLECTIONS_KEY, (current) => [
        ...(current ?? []),
        row,
      ]);
      return { collections };
    },
    onError: (_error, _row, snapshot) => {
      if (snapshot) queryClient.setQueryData(COLLECTIONS_KEY, snapshot.collections);
      toast.error("Couldn't create that collection.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });

  const update = useMutation({
    mutationKey: ["collection-update"],
    mutationFn: async ({ id, patch }: { id: string; patch: ReturnType<typeof cleanPatch> }) => {
      const { error } = await createClient().from("collections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: COLLECTIONS_KEY });
      const collections = queryClient.getQueryData<SidebarCollection[]>(COLLECTIONS_KEY);
      queryClient.setQueryData<SidebarCollection[]>(COLLECTIONS_KEY, (current) =>
        current?.map((collection) =>
          collection.id === id ? { ...collection, ...patch } : collection,
        ),
      );
      return { collections };
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) queryClient.setQueryData(COLLECTIONS_KEY, snapshot.collections);
      toast.error("Couldn't save your changes.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });

  const remove = useMutation({
    mutationKey: ["collection-remove"],
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await createClient().from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: COLLECTIONS_KEY });
      const collections = queryClient.getQueryData<SidebarCollection[]>(COLLECTIONS_KEY);
      queryClient.setQueryData<SidebarCollection[]>(COLLECTIONS_KEY, (current) =>
        current?.filter((collection) => collection.id !== id),
      );
      return { collections };
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) queryClient.setQueryData(COLLECTIONS_KEY, snapshot.collections);
      toast.error("Couldn't delete that collection.");
    },
    onSuccess: (_data, { id }) => {
      if (pathnameRef.current === viewHref({ type: "collection", collectionId: id })) {
        router.push("/app");
      }
    },
    // Its items are in the Inbox now: lists, counts and open drawers must refetch.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["item"] }),
        queryClient.invalidateQueries({ queryKey: ["counts"] }),
      ]),
  });

  const { mutateAsync: createAsync } = create;
  const { mutateAsync: updateAsync } = update;
  const { mutateAsync: removeAsync } = remove;

  return useMemo<CollectionActions>(
    () => ({
      create: async (input) => {
        const name = normalizeCollectionName(input.name);
        if (!isValidCollectionName(name)) return null;
        const row: SidebarCollection = {
          id: crypto.randomUUID(),
          name,
          emoji: input.emoji ? input.emoji : null,
          color: isAuroraColor(input.color) ? input.color : null,
          position: nextPosition(queryClient.getQueryData<SidebarCollection[]>(COLLECTIONS_KEY)),
        };
        try {
          await createAsync(row);
          return row;
        } catch {
          // onError already rolled back and showed the toast.
          return null;
        }
      },
      update: async (id, patch) => {
        const clean = cleanPatch(patch);
        if (clean.name !== undefined && !isValidCollectionName(clean.name)) return false;
        if (Object.keys(clean).length === 0) return false;
        try {
          await updateAsync({ id, patch: clean });
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
    [queryClient, createAsync, updateAsync, removeAsync],
  );
}
