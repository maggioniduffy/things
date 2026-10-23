import type { Messages } from "@/i18n/messages";
import type { BatchAction } from "@/lib/items/batch-mutations";

/** `data` of a sidebar droppable: what dropping cards on it does. */
export type SidebarDropData = {
  type: "sidebar-target";
  action: BatchAction;
  /** Display name for toasts and screen reader announcements, e.g. "Reading". */
  label: string;
};

/** A sidebar row that accepts dropped cards. `id` is the dnd-kit droppable id. */
export type DropTarget = { id: string; action: BatchAction; label: string };

export function isSidebarDropData(value: unknown): value is SidebarDropData {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "sidebar-target"
  );
}

export function dropData(target: DropTarget): SidebarDropData {
  return { type: "sidebar-target", action: target.action, label: target.label };
}

/** The `shell.views` copy of one locale: `useT().shell.views` in components. */
type Views = Messages["shell"]["views"];

export const inboxTarget = (views: Views): DropTarget => ({
  id: "target:inbox",
  action: { type: "collection", id: null },
  label: views.inbox,
});
export const favoritesTarget = (views: Views): DropTarget => ({
  id: "target:favorites",
  action: { type: "favorite" },
  label: views.favorites,
});
export const archiveTarget = (views: Views): DropTarget => ({
  id: "target:archive",
  action: { type: "archive" },
  label: views.archive,
});
export const trashTarget = (views: Views): DropTarget => ({
  id: "target:trash",
  action: { type: "trash" },
  label: views.trash,
});

export function collectionTarget(id: string, name: string): DropTarget {
  return { id: `target:collection:${id}`, action: { type: "collection", id }, label: name };
}

export function tagTarget(id: string, name: string): DropTarget {
  return { id: `target:tag:${id}`, action: { type: "tag", id }, label: name };
}

/** The sidebar lists whose rows the user can reorder. */
export type SidebarSortSection = "collections" | "smart-views";

/**
 * `data` of a sortable sidebar row. These rows only trade places with rows of their own section;
 * they are never drop targets for cards (the row's link is, through `SidebarDropData`).
 */
export type SidebarSortData = {
  type: "sidebar-sort";
  section: SidebarSortSection;
  /** The collection or smart view id. */
  id: string;
  /** Display name for screen reader announcements, e.g. "collection Reading". */
  label: string;
};

export function isSidebarSortData(value: unknown): value is SidebarSortData {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "sidebar-sort"
  );
}

/** The dnd-kit id of a sortable sidebar row. */
export function sidebarSortId(section: SidebarSortSection, id: string): string {
  return `sort:${section}:${id}`;
}
