"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getActiveMessages } from "@/i18n/active";
import { normalizeCollectionName } from "@/lib/collections/fields";
import { cleanRules, type Rules } from "@/lib/filters";
import { keyAfter } from "@/lib/order";
import type { SidebarSmartView } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { viewHref, viewKey } from "@/lib/views";
import type { Json } from "@/types/database.types";

const SMART_VIEWS_KEY = ["smart-views"] as const;

/** `smart_views.name` allows 1 to 80 characters. */
export const MAX_SMART_VIEW_NAME_LENGTH = 80;

export function isValidSmartViewName(name: string): boolean {
  return name !== "" && [...name].length <= MAX_SMART_VIEW_NAME_LENGTH;
}

export type SmartViewInput = {
  name: string;
  icon?: string | null;
  rules: Rules;
};
export type SmartViewPatch = Partial<SmartViewInput>;

export type SmartViewActions = {
  /** Appends a view after the last one. Null when it failed (or the name is not valid). */
  create(input: SmartViewInput): Promise<SidebarSmartView | null>;
  /** Rename and/or change icon and rules. True when the change was applied. */
  update(id: string, patch: SmartViewPatch): Promise<boolean>;
  /** True when it was deleted. Leaves the page if that view is open. */
  remove(id: string): Promise<boolean>;
};

type Snapshot = { views: SidebarSmartView[] | undefined };
type StoredPatch = Partial<Pick<SidebarSmartView, "name" | "icon" | "rules">>;

/** The position after every cached smart view. */
function nextPosition(views: readonly SidebarSmartView[] | undefined): string {
  let last: string | null = null;
  for (const { position } of views ?? []) {
    if (last === null || position > last) last = position;
  }
  return keyAfter(last);
}

function cleanPatch(patch: SmartViewPatch): StoredPatch {
  const clean: StoredPatch = {};
  if (patch.name !== undefined) clean.name = normalizeCollectionName(patch.name);
  if (patch.icon !== undefined) clean.icon = patch.icon === "" ? null : patch.icon;
  if (patch.rules !== undefined) clean.rules = cleanRules(patch.rules);
  return clean;
}

/** Optimistic create / update / delete of smart views: apply to the cache at once, roll back on error. */
export function useSmartViewActions(): SmartViewActions {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  });

  const create = useMutation({
    mutationKey: ["smart-view-create"],
    mutationFn: async (row: SidebarSmartView) => {
      const { error } = await createClient()
        .from("smart_views")
        .insert({
          id: row.id,
          name: row.name,
          icon: row.icon,
          rules: row.rules as NonNullable<Json>,
          position: row.position,
        });
      if (error) throw error;
    },
    onMutate: async (row): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: SMART_VIEWS_KEY });
      const views = queryClient.getQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY);
      queryClient.setQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY, (current) => [
        ...(current ?? []),
        row,
      ]);
      return { views };
    },
    onError: (_error, _row, snapshot) => {
      if (snapshot) queryClient.setQueryData(SMART_VIEWS_KEY, snapshot.views);
      toast.error(getActiveMessages().shell.toasts.smartViewCreateFailed);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SMART_VIEWS_KEY }),
  });

  const update = useMutation({
    mutationKey: ["smart-view-update"],
    mutationFn: async ({ id, patch }: { id: string; patch: StoredPatch }) => {
      const { rules, ...rest } = patch;
      const { error } = await createClient()
        .from("smart_views")
        .update(rules === undefined ? rest : { ...rest, rules: rules as NonNullable<Json> })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: SMART_VIEWS_KEY });
      const views = queryClient.getQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY);
      queryClient.setQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY, (current) =>
        current?.map((view) =>
          view.id === id
            ? {
                ...view,
                ...patch,
                ...(patch.rules ? { invalidRules: undefined } : {}),
              }
            : view,
        ),
      );
      return { views };
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) queryClient.setQueryData(SMART_VIEWS_KEY, snapshot.views);
      toast.error(getActiveMessages().shell.toasts.smartViewSaveFailed);
    },
    onSettled: (_data, _error, { id, patch }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: SMART_VIEWS_KEY }),
        // New rules mean a different list of items.
        patch.rules !== undefined
          ? queryClient.invalidateQueries({
              queryKey: ["items", viewKey({ type: "smart", viewId: id })],
            })
          : undefined,
      ]),
  });

  const remove = useMutation({
    mutationKey: ["smart-view-remove"],
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await createClient().from("smart_views").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id }): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: SMART_VIEWS_KEY });
      const views = queryClient.getQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY);
      queryClient.setQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY, (current) =>
        current?.filter((view) => view.id !== id),
      );
      return { views };
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) queryClient.setQueryData(SMART_VIEWS_KEY, snapshot.views);
      toast.error(getActiveMessages().shell.toasts.smartViewDeleteFailed);
    },
    onSuccess: (_data, { id }) => {
      // Items are untouched: only the saved filter goes away.
      queryClient.removeQueries({ queryKey: ["items", viewKey({ type: "smart", viewId: id })] });
      if (pathnameRef.current === viewHref({ type: "smart", viewId: id })) {
        router.push("/app");
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SMART_VIEWS_KEY }),
  });

  const { mutateAsync: createAsync } = create;
  const { mutateAsync: updateAsync } = update;
  const { mutateAsync: removeAsync } = remove;

  return useMemo<SmartViewActions>(
    () => ({
      create: async (input) => {
        const name = normalizeCollectionName(input.name);
        if (!isValidSmartViewName(name)) return null;
        const row: SidebarSmartView = {
          id: crypto.randomUUID(),
          name,
          icon: input.icon ? input.icon : null,
          rules: cleanRules(input.rules),
          position: nextPosition(queryClient.getQueryData<SidebarSmartView[]>(SMART_VIEWS_KEY)),
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
        if (clean.name !== undefined && !isValidSmartViewName(clean.name)) return false;
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
