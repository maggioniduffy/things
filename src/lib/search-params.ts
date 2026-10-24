import { z } from "zod";
import { cleanRules, parseDomainList, type SearchRules } from "@/lib/filters";
import { ITEM_KINDS } from "@/lib/views";
import type { ItemKind } from "@/types/supabase";

/** The status chips: `unread` and `read` exclude each other, `favorite` combines with either. */
export const SEARCH_STATUSES = ["unread", "read", "favorite"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

/** The board's search state, as it lives in the URL (`q`, `kind`, `tag`, `domain`, `status`). */
export type BoardSearch = {
  q: string;
  kinds: ItemKind[];
  tagIds: string[];
  domains: string[];
  statuses: SearchStatus[];
};

/** Every URL param this module owns; all other params (`sort`, `item`, ...) are left alone. */
export const SEARCH_PARAM_KEYS = ["q", "kind", "tag", "domain", "status"] as const;

const uuidSchema = z.uuid();

type ParamSource =
  URLSearchParams | { readonly [key: string]: string | string[] | undefined } | undefined;

function readParam(source: ParamSource, key: string): string {
  if (!source) return "";
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  const value = source[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** An empty search: no text, no chips. */
export const NO_SEARCH: BoardSearch = { q: "", kinds: [], tagIds: [], domains: [], statuses: [] };

/** True when there is neither text nor a chip. */
export function isEmptySearch(search: BoardSearch): boolean {
  return (
    search.q === "" &&
    search.kinds.length === 0 &&
    search.tagIds.length === 0 &&
    search.domains.length === 0 &&
    search.statuses.length === 0
  );
}

/**
 * Reads the search state from URL params (a browser `URLSearchParams` or the server's
 * `searchParams` object). Null when there is no text and no chip. Invalid chip values are dropped.
 */
export function parseSearchParams(source: ParamSource): BoardSearch | null {
  const q = readParam(source, "q").replace(/\s+/g, " ").trim();
  const kinds = unique(
    splitList(readParam(source, "kind")).filter((kind): kind is ItemKind =>
      (ITEM_KINDS as readonly string[]).includes(kind),
    ),
  );
  const tagIds = unique(
    splitList(readParam(source, "tag")).filter((id) => uuidSchema.safeParse(id).success),
  );
  const domains = parseDomainList(readParam(source, "domain"));
  const statuses = unique(
    splitList(readParam(source, "status")).filter((status): status is SearchStatus =>
      (SEARCH_STATUSES as readonly string[]).includes(status),
    ),
  );
  const search: BoardSearch = { q, kinds, tagIds, domains, statuses };
  return isEmptySearch(search) ? null : search;
}

/**
 * `pathname` plus `current` params with the search params replaced by `search` (null clears them).
 * Every other param (`sort`, `item`) is kept as it was.
 */
export function searchParamsHref(
  pathname: string,
  current: URLSearchParams | string,
  search: BoardSearch | null,
): string {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());
  for (const key of SEARCH_PARAM_KEYS) params.delete(key);
  if (search) {
    if (search.q) params.set("q", search.q);
    if (search.kinds.length > 0) params.set("kind", search.kinds.join(","));
    if (search.tagIds.length > 0) params.set("tag", search.tagIds.join(","));
    if (search.domains.length > 0) params.set("domain", search.domains.join(","));
    if (search.statuses.length > 0) params.set("status", search.statuses.join(","));
  }
  const query = params.toString().replace(/%2C/gi, ",");
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * The `search_items` rules for a search inside a view: the view's own rules narrowed by the chips.
 * Kinds and domains intersect, tags union (the item needs them all), status maps to `isRead` and
 * `isFavorite`. "empty" when the chips contradict the view, so no request is needed.
 */
export function mergeSearchRules(
  viewRules: SearchRules,
  search: BoardSearch,
): SearchRules | "empty" {
  const merged: SearchRules = { ...viewRules };

  if (search.kinds.length > 0) {
    const kinds = viewRules.kinds
      ? search.kinds.filter((kind) => viewRules.kinds?.includes(kind))
      : search.kinds;
    if (kinds.length === 0) return "empty";
    merged.kinds = kinds;
  }

  if (search.domains.length > 0) {
    const viewDomains = cleanRules({ domains: viewRules.domains }).domains;
    const domains = viewDomains
      ? search.domains.filter((domain) => viewDomains.includes(domain))
      : search.domains;
    if (domains.length === 0) return "empty";
    merged.domains = domains;
  }

  if (search.tagIds.length > 0) {
    merged.tagIds = unique([...(viewRules.tagIds ?? []), ...search.tagIds]);
  }

  const wantsUnread = search.statuses.includes("unread");
  const wantsRead = search.statuses.includes("read");
  if (wantsUnread && wantsRead) return "empty";
  if (wantsUnread || wantsRead) {
    const isRead = wantsRead;
    if (viewRules.isRead !== undefined && viewRules.isRead !== isRead) return "empty";
    merged.isRead = isRead;
  }
  if (search.statuses.includes("favorite")) {
    if (viewRules.isFavorite === false) return "empty";
    merged.isFavorite = true;
  }

  return merged;
}
