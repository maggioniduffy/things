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

export const INBOX_TARGET: DropTarget = {
  id: "target:inbox",
  action: { type: "collection", id: null },
  label: "Inbox",
};
export const FAVORITES_TARGET: DropTarget = {
  id: "target:favorites",
  action: { type: "favorite" },
  label: "Favorites",
};
export const ARCHIVE_TARGET: DropTarget = {
  id: "target:archive",
  action: { type: "archive" },
  label: "Archive",
};
export const TRASH_TARGET: DropTarget = {
  id: "target:trash",
  action: { type: "trash" },
  label: "Trash",
};

export function collectionTarget(id: string, name: string): DropTarget {
  return { id: `target:collection:${id}`, action: { type: "collection", id }, label: name };
}

export function tagTarget(id: string, name: string): DropTarget {
  return { id: `target:tag:${id}`, action: { type: "tag", id }, label: name };
}
