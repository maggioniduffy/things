"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { planMove, type OrderedRow, type PositionUpdate } from "@/lib/order";
import { createClient } from "@/lib/supabase/client";

/** The sidebar lists with a manual order. */
export type SidebarOrderSection = "collections" | "smart-views";

const CONFIG = {
  collections: { queryKey: ["collections"], table: "collections" },
  "smart-views": { queryKey: ["smart-views"], table: "smart_views" },
} as const;

type Row = OrderedRow & Record<string, unknown>;

/** `rows` with the new positions applied, sorted like the queries (`position`, then `id`). */
export function applySidebarPositions<T extends OrderedRow>(
  rows: readonly T[],
  updates: readonly PositionUpdate[],
): T[] {
  const byId = new Map(updates.map((update) => [update.id, update.position]));
  return rows
    .map((row) => (byId.has(row.id) ? { ...row, position: byId.get(row.id) ?? row.position } : row))
    .sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1,
    );
}

async function writePosition(section: SidebarOrderSection, { id, position }: PositionUpdate) {
  const client = createClient();
  const { error } =
    section === "collections"
      ? await client.from("collections").update({ position }).eq("id", id)
      : await client.from("smart_views").update({ position }).eq("id", id);
  if (error) throw error;
}

/**
 * Optimistic reorder of a sidebar list: moves row `movedId` to index `toIndex` of the cached rows.
 * Writes only the moved row's `position`, a key between its new neighbours (more rows only when
 * neighbours share a position). The cache changes synchronously, before the request, so the row
 * does not flash back to its old slot. Rolls back with a toast when the write fails.
 */
export function useSidebarReorder(
  section: SidebarOrderSection,
): (movedId: string, toIndex: number) => Promise<void> {
  const queryClient = useQueryClient();
  const { queryKey } = CONFIG[section];

  const mutation = useMutation({
    mutationKey: ["sidebar-reorder", section],
    mutationFn: async ({ updates }: { updates: PositionUpdate[]; previous: Row[] | undefined }) => {
      for (const update of updates) await writePosition(section, update);
    },
    onError: (_error, { previous }) => {
      queryClient.setQueryData(queryKey, previous);
      toast.error("Couldn't move that.");
    },
    onSettled: () => {
      // Only the last of overlapping reorders refetches, or it would flash older data.
      if (queryClient.isMutating({ mutationKey: ["sidebar-reorder", section] }) > 1) return;
      return queryClient.invalidateQueries({ queryKey });
    },
  });
  const { mutateAsync } = mutation;

  return useMemo(
    () => async (movedId: string, toIndex: number) => {
      const previous = queryClient.getQueryData<Row[]>(queryKey);
      if (!previous) return;
      let updates: PositionUpdate[];
      try {
        updates = planMove(previous, movedId, toIndex);
      } catch {
        // fractional-indexing throws on a malformed stored key.
        toast.error("Couldn't move that.");
        return;
      }
      if (updates.length === 0) return;
      // Synchronous, in the same tick as the drop: no frame with the old order.
      void queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, applySidebarPositions(previous, updates));
      try {
        await mutateAsync({ updates, previous });
      } catch {
        // onError already rolled back and showed the toast.
      }
    },
    [mutateAsync, queryClient, queryKey],
  );
}
