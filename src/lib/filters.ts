import { z } from "zod";
import { getActiveMessages } from "@/i18n/active";
import { kindPluralLabel } from "@/lib/kinds";
import { ITEM_KINDS } from "@/lib/views";

/**
 * Smart-view rules: a saved set of filters. Every field is optional and they all apply together
 * (AND). `tagIds` matches items that have ALL the tags. Stored as JSON in `smart_views.rules`.
 */
/** Upper bound for "saved within": larger values push the start date outside what Date supports. */
export const MAX_SAVED_WITHIN_DAYS = 36500;

/** What a stored domain may contain; anything else could not match `items.domain` anyway. */
const DOMAIN_PATTERN = /^[a-z0-9.-]+(:\d+)?$/;

export const Rules = z.object({
  kinds: z.array(z.enum(ITEM_KINDS)).optional(),
  collectionIds: z.array(z.uuid()).optional(),
  tagIds: z.array(z.uuid()).optional(), // match all
  domains: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  savedWithinDays: z.number().int().positive().max(MAX_SAVED_WITHIN_DAYS).optional(),
  query: z.string().optional(), // full-text
});

export type Rules = z.infer<typeof Rules>;

export type ParsedRules = {
  rules: Rules;
  /** The stored JSON was not valid rules; `rules` is the safe empty set. */
  invalid: boolean;
};

/** `{}`: matches every live item. */
export const EMPTY_RULES: Rules = {};

/**
 * Reads rules from stored JSON (an object, or a JSON string). Never throws: anything that is not
 * valid rules gives the empty rules and `invalid: true`, so a broken row cannot break the page.
 */
export function parseRules(json: unknown): ParsedRules {
  let value = json;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { rules: {}, invalid: true };
    }
  }
  const result = Rules.safeParse(value);
  return result.success ? { rules: result.data, invalid: false } : { rules: {}, invalid: true };
}

/**
 * Rules as stored: empty lists, blank text and duplicates dropped, so "no rule" is always an
 * absent key and `parseRules(cleanRules(x))` equals `cleanRules(x)`.
 */
export function cleanRules(rules: Rules): Rules {
  const clean: Rules = {};
  const kinds = unique(rules.kinds);
  if (kinds.length > 0) clean.kinds = kinds;
  const collectionIds = unique(rules.collectionIds);
  if (collectionIds.length > 0) clean.collectionIds = collectionIds;
  const tagIds = unique(rules.tagIds);
  if (tagIds.length > 0) clean.tagIds = tagIds;
  const domains = unique(
    rules.domains?.map((domain) => domain.trim()).filter((domain) => DOMAIN_PATTERN.test(domain)),
  );
  if (domains.length > 0) clean.domains = domains;
  if (rules.isRead !== undefined) clean.isRead = rules.isRead;
  if (rules.isFavorite !== undefined) clean.isFavorite = rules.isFavorite;
  if (rules.savedWithinDays !== undefined) clean.savedWithinDays = rules.savedWithinDays;
  const query = rules.query?.replace(/\s+/g, " ").trim();
  if (query) clean.query = query;
  return clean;
}

function unique<T>(values: readonly T[] | undefined): T[] {
  return values ? [...new Set(values)] : [];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Alias of the `item_tags` embed that checks the tag at `index` (one embed per tag). */
export function tagEmbedAlias(index: number): string {
  return `rule_tag_${index}`;
}

/** Keys `ruleSelect` adds to every row; strip them before the row reaches the UI. */
export function isRuleEmbedKey(key: string): boolean {
  return /^rule_tag_\d+$/.test(key);
}

/**
 * The `select` string for a query that `applyRules` will filter: `columns`, plus one inner-joined
 * `item_tags` embed per required tag.
 *
 * Tag match-all in ONE request: PostgREST allows the same relationship embedded several times
 * under different aliases, and `!inner` turns each embed into a join that drops rows without a
 * match. `applyRules` then filters `rule_tag_<i>.tag_id = <tag i>`, so an item survives only when
 * it has every tag. No per-tag requests, no client-side filtering of a page.
 */
export function ruleSelect(columns: string, rules: Rules): string {
  const embeds = unique(rules.tagIds).map(
    (_tagId, index) => `${tagEmbedAlias(index)}:item_tags!inner(tag_id)`,
  );
  return [columns, ...embeds].join(",");
}

/** The slice of the postgrest-js filter builder that `applyRules` uses; every method returns the builder. */
export interface RulesFilterable<Self> {
  is(column: string, value: null): Self;
  eq(column: string, value: string | boolean): Self;
  in(column: string, values: readonly string[]): Self;
  gte(column: string, value: string): Self;
  textSearch(column: string, query: string, options: { type: "websearch"; config: string }): Self;
}

/** Removes diacritics, like the `f_unaccent` that builds the `search` column. */
function unaccent(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/**
 * Applies smart-view rules to an items query that was selected with `ruleSelect`. Smart views show
 * live items only: trashed and archived rows are excluded, like the other filter views.
 *
 * `query` uses the generated `search` tsvector (`simple` config, websearch syntax). Phase 7's
 * `search_items` RPC replaces it (trigram typo tolerance, ranking) and takes these same rules.
 */
export function applyRules<Q extends RulesFilterable<Q>>(
  query: Q,
  rules: Rules,
  now: Date = new Date(),
): Q {
  let q = query.is("deleted_at", null).is("archived_at", null);

  const kinds = unique(rules.kinds);
  if (kinds.length > 0) q = q.in("kind", kinds);

  const collectionIds = unique(rules.collectionIds);
  if (collectionIds.length > 0) q = q.in("collection_id", collectionIds);

  const tagIds = unique(rules.tagIds);
  tagIds.forEach((tagId, index) => {
    q = q.eq(`${tagEmbedAlias(index)}.tag_id`, tagId);
  });

  const domains = unique(
    rules.domains?.map((domain) => domain.trim()).filter((domain) => DOMAIN_PATTERN.test(domain)),
  );
  if (domains.length > 0) q = q.in("domain", domains);

  if (rules.isRead !== undefined) q = q.eq("is_read", rules.isRead);
  if (rules.isFavorite !== undefined) q = q.eq("is_favorite", rules.isFavorite);

  if (rules.savedWithinDays !== undefined) {
    q = q.gte("created_at", new Date(now.getTime() - rules.savedWithinDays * DAY_MS).toISOString());
  }

  const text = rules.query ? unaccent(rules.query).trim() : "";
  if (text) q = q.textSearch("search", text, { type: "websearch", config: "simple" });

  return q;
}

/**
 * Domains typed in the builder: split on commas, spaces and new lines; a pasted URL becomes its
 * host; lower case, no `www.` (the form `items.domain` is stored in). Duplicates and blanks go.
 */
export function parseDomainList(text: string): string[] {
  const domains = text
    .split(/[\s,;]+/)
    .map((raw) =>
      raw
        .trim()
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
        .replace(/[/?#].*$/, "")
        .replace(/^www\./, ""),
    )
    .filter((domain) => DOMAIN_PATTERN.test(domain));
  return unique(domains);
}

/** Names the toolbar summary needs to show collections and tags by name. */
export type RuleLookups = {
  collections: readonly { id: string; name: string }[];
  tags: readonly { id: string; name: string }[];
};

function listOf(parts: readonly string[]): string {
  return parts.join(", ");
}

/** Short pieces of a plain-language summary, e.g. `["PDFs and links", "unread", "last 7 days"]`. */
export function describeRules(rules: Rules, lookups: RuleLookups): string[] {
  const t = getActiveMessages().shell.rules;
  const clean = cleanRules(rules);
  const parts: string[] = [];
  if (clean.kinds) parts.push(t.kind(listOf(clean.kinds.map(kindPluralLabel))));
  if (clean.collectionIds) {
    const names = clean.collectionIds.map(
      (id) => lookups.collections.find((collection) => collection.id === id)?.name ?? t.unknown,
    );
    parts.push(t.in(listOf(names)));
  }
  if (clean.tagIds) {
    const names = clean.tagIds.map((id) => {
      const name = lookups.tags.find((tag) => tag.id === id)?.name;
      return name ? `#${name}` : t.unknownTag;
    });
    parts.push(t.tagged(listOf(names)));
  }
  if (clean.domains) parts.push(t.from(listOf(clean.domains)));
  if (clean.isRead !== undefined) parts.push(clean.isRead ? t.read : t.unread);
  if (clean.isFavorite !== undefined) {
    parts.push(clean.isFavorite ? t.favorites : t.notFavorites);
  }
  if (clean.savedWithinDays !== undefined) {
    parts.push(
      clean.savedWithinDays === 1 ? t.savedLastDay : t.savedLastDays(clean.savedWithinDays),
    );
  }
  if (clean.query) parts.push(t.matching(clean.query));
  return parts;
}
