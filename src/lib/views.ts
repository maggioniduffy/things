import { z } from "zod";
import type { ItemKind } from "@/types/supabase";

export type SystemView = "inbox" | "all" | "unread" | "favorites" | "archive" | "trash";

export type ViewSpec =
  | { type: SystemView }
  | { type: "kind"; kind: ItemKind }
  | { type: "collection"; collectionId: string }
  | { type: "tag"; tagId: string }
  | { type: "smart"; viewId: string };

/** Every item_kind enum value, in sidebar order. */
export const ITEM_KINDS = [
  "link",
  "article",
  "video",
  "image",
  "pdf",
  "document",
  "note",
  "audio",
  "code",
  "other",
] as const satisfies readonly ItemKind[];

// Compile-time exhaustiveness: fails if the enum gains or loses a value that ITEM_KINDS lacks.
type MissingKinds = Exclude<ItemKind, (typeof ITEM_KINDS)[number]>;
const _allKindsListed: [MissingKinds] extends [never] ? true : never = true;
void _allKindsListed;

// Inbox is the bare /app route, so it is not part of this list.
const NAMED_SYSTEM_VIEWS = ["all", "unread", "favorites", "archive", "trash"] as const;

const uuidSchema = z.uuid();

function isKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}

function isNamedSystemView(value: string): value is (typeof NAMED_SYSTEM_VIEWS)[number] {
  return (NAMED_SYSTEM_VIEWS as readonly string[]).includes(value);
}

/** Turns `/app/[[...view]]` params into a ViewSpec. Returns null for anything unknown (404). */
export function parseView(segments: string[] | undefined): ViewSpec | null {
  if (!segments || segments.length === 0) return { type: "inbox" };

  if (segments.length === 1) {
    const word = segments[0] ?? "";
    return isNamedSystemView(word) ? { type: word } : null;
  }

  if (segments.length === 2) {
    const prefix = segments[0];
    const value = segments[1] ?? "";
    switch (prefix) {
      case "f":
        return isKind(value) ? { type: "kind", kind: value } : null;
      case "c":
        return uuidSchema.safeParse(value).success
          ? { type: "collection", collectionId: value }
          : null;
      case "t":
        return uuidSchema.safeParse(value).success ? { type: "tag", tagId: value } : null;
      case "v":
        return uuidSchema.safeParse(value).success ? { type: "smart", viewId: value } : null;
      default:
        return null;
    }
  }

  return null;
}

export function viewHref(view: ViewSpec): string {
  switch (view.type) {
    case "inbox":
      return "/app";
    case "kind":
      return `/app/f/${view.kind}`;
    case "collection":
      return `/app/c/${view.collectionId}`;
    case "tag":
      return `/app/t/${view.tagId}`;
    case "smart":
      return `/app/v/${view.viewId}`;
    default:
      return `/app/${view.type}`;
  }
}

/** Stable string for query keys. */
export function viewKey(view: ViewSpec): string {
  switch (view.type) {
    case "kind":
      return `kind:${view.kind}`;
    case "collection":
      return `collection:${view.collectionId}`;
    case "tag":
      return `tag:${view.tagId}`;
    case "smart":
      return `smart:${view.viewId}`;
    default:
      return view.type;
  }
}

export type SortMode = "manual" | "newest" | "oldest" | "title";

export const SORT_MODES = [
  "manual",
  "newest",
  "oldest",
  "title",
] as const satisfies readonly SortMode[];

/** Reads `?sort=`; missing or invalid values fall back to "manual". */
export function parseSort(value: string | string[] | undefined): SortMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return (SORT_MODES as readonly string[]).includes(raw ?? "") ? (raw as SortMode) : "manual";
}
