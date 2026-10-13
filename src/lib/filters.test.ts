import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/supabase";
import {
  EMPTY_RULES,
  Rules,
  applyRules,
  cleanRules,
  describeRules,
  isRuleEmbedKey,
  parseDomainList,
  parseRules,
  ruleSelect,
  tagEmbedAlias,
  type RulesFilterable,
} from "./filters";

const COLLECTION_A = "33333333-3333-4333-8333-333333333333";
const COLLECTION_B = "66666666-6666-4666-8666-666666666666";
const TAG_A = "44444444-4444-4444-8444-444444444444";
const TAG_B = "55555555-5555-4555-8555-555555555555";

const FULL: Rules = {
  kinds: ["pdf", "link"],
  collectionIds: [COLLECTION_A, COLLECTION_B],
  tagIds: [TAG_A, TAG_B],
  domains: ["example.com"],
  isRead: false,
  isFavorite: true,
  savedWithinDays: 7,
  query: "thesis notes",
};

describe("parseRules", () => {
  it("round-trips: object -> JSON -> parse -> equal", () => {
    for (const rules of [FULL, EMPTY_RULES, { isRead: true }, { kinds: ["pdf" as const] }]) {
      const parsed = parseRules(JSON.parse(JSON.stringify(rules)));
      expect(parsed).toEqual({ rules, invalid: false });
    }
  });

  it("accepts a JSON string", () => {
    expect(parseRules(JSON.stringify(FULL))).toEqual({ rules: FULL, invalid: false });
  });

  it.each([
    ["broken JSON", "{not json"],
    ["null", null],
    ["a number", 3],
    ["an array", []],
    ["an unknown kind", { kinds: ["spreadsheet"] }],
    ["a bad uuid", { tagIds: ["nope"] }],
    ["a zero window", { savedWithinDays: 0 }],
    ["a fractional window", { savedWithinDays: 1.5 }],
    ["a string boolean", { isRead: "yes" }],
  ])("never throws on %s: empty rules and the invalid flag", (_name, input) => {
    expect(parseRules(input)).toEqual({ rules: {}, invalid: true });
  });

  it("drops unknown keys", () => {
    expect(parseRules({ isRead: true, extra: 1 })).toEqual({
      rules: { isRead: true },
      invalid: false,
    });
  });

  it("the schema is the plan's", () => {
    expect(Object.keys(Rules.shape).sort()).toEqual(
      [
        "collectionIds",
        "domains",
        "isFavorite",
        "isRead",
        "kinds",
        "query",
        "savedWithinDays",
        "tagIds",
      ].sort(),
    );
  });
});

describe("cleanRules", () => {
  it("drops empty lists, blank text and duplicates", () => {
    expect(
      cleanRules({
        kinds: [],
        collectionIds: [COLLECTION_A, COLLECTION_A],
        tagIds: [],
        domains: [" a.com ", "", "a.com"],
        query: "   ",
        isRead: false,
      }),
    ).toEqual({ collectionIds: [COLLECTION_A], domains: ["a.com"], isRead: false });
  });

  it("is idempotent and survives a round trip", () => {
    const once = cleanRules(FULL);
    expect(cleanRules(once)).toEqual(once);
    expect(parseRules(JSON.parse(JSON.stringify(once))).rules).toEqual(once);
  });
});

/** Records every filter call; each returns the same builder, like postgrest-js. */
interface Recorder extends RulesFilterable<Recorder> {
  calls: [string, ...unknown[]][];
}

function recorder() {
  const calls: Recorder["calls"] = [];
  const builder: Recorder = {
    calls,
    is: (...args) => (calls.push(["is", ...args]), builder),
    eq: (...args) => (calls.push(["eq", ...args]), builder),
    in: (...args) => (calls.push(["in", ...args]), builder),
    gte: (...args) => (calls.push(["gte", ...args]), builder),
    textSearch: (...args) => (calls.push(["textSearch", ...args]), builder),
  };
  return { builder, calls };
}

const NOW = new Date("2026-03-10T12:00:00.000Z");
const LIVE: [string, ...unknown[]][] = [
  ["is", "deleted_at", null],
  ["is", "archived_at", null],
];

describe("applyRules", () => {
  it("empty rules: only the live-items filter", () => {
    const { builder, calls } = recorder();
    expect(applyRules(builder, {}, NOW)).toBe(builder);
    expect(calls).toEqual(LIVE);
  });

  it("kinds", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { kinds: ["pdf", "note"] }, NOW);
    expect(calls).toEqual([...LIVE, ["in", "kind", ["pdf", "note"]]]);
  });

  it("collectionIds", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { collectionIds: [COLLECTION_A, COLLECTION_B] }, NOW);
    expect(calls).toEqual([...LIVE, ["in", "collection_id", [COLLECTION_A, COLLECTION_B]]]);
  });

  it("tagIds: one aliased inner embed filter per tag (match all)", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { tagIds: [TAG_A, TAG_B] }, NOW);
    expect(calls).toEqual([
      ...LIVE,
      ["eq", "rule_tag_0.tag_id", TAG_A],
      ["eq", "rule_tag_1.tag_id", TAG_B],
    ]);
  });

  it("tagIds: duplicates share one embed", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { tagIds: [TAG_A, TAG_A] }, NOW);
    expect(calls.filter(([op]) => op === "eq")).toEqual([["eq", "rule_tag_0.tag_id", TAG_A]]);
  });

  it("domains (blank entries ignored)", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { domains: ["a.com", " ", "b.org"] }, NOW);
    expect(calls).toEqual([...LIVE, ["in", "domain", ["a.com", "b.org"]]]);
  });

  it("isRead and isFavorite, true and false", () => {
    for (const value of [true, false]) {
      const { builder, calls } = recorder();
      applyRules(builder, { isRead: value, isFavorite: !value }, NOW);
      expect(calls).toEqual([...LIVE, ["eq", "is_read", value], ["eq", "is_favorite", !value]]);
    }
  });

  it("savedWithinDays: created_at >= now - N days", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { savedWithinDays: 7 }, NOW);
    expect(calls).toEqual([...LIVE, ["gte", "created_at", "2026-03-03T12:00:00.000Z"]]);
  });

  it("query: websearch on the search column, simple config, accents removed", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { query: "canción -rock" }, NOW);
    expect(calls).toEqual([
      ...LIVE,
      ["textSearch", "search", "cancion -rock", { type: "websearch", config: "simple" }],
    ]);
  });

  it("a blank query adds nothing", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { query: "  " }, NOW);
    expect(calls).toEqual(LIVE);
  });

  it("every rule together", () => {
    const { builder, calls } = recorder();
    applyRules(builder, FULL, NOW);
    expect(calls.map(([op, column]) => `${op}:${String(column)}`)).toEqual([
      "is:deleted_at",
      "is:archived_at",
      "in:kind",
      "in:collection_id",
      "eq:rule_tag_0.tag_id",
      "eq:rule_tag_1.tag_id",
      "in:domain",
      "eq:is_read",
      "eq:is_favorite",
      "gte:created_at",
      "textSearch:search",
    ]);
  });

  it("defaults `now` to the current time", () => {
    const { builder, calls } = recorder();
    applyRules(builder, { savedWithinDays: 1 });
    const value = Date.parse(String(calls[2]?.[2]));
    expect(Date.now() - value).toBeGreaterThan(24 * 3600 * 1000 - 5000);
    expect(Date.now() - value).toBeLessThan(24 * 3600 * 1000 + 5000);
  });
});

describe("ruleSelect", () => {
  it("adds nothing without tags", () => {
    expect(ruleSelect("id,title", { kinds: ["pdf"] })).toBe("id,title");
  });

  it("adds one aliased inner embed per distinct tag", () => {
    expect(ruleSelect("id", { tagIds: [TAG_A, TAG_B, TAG_A] })).toBe(
      "id,rule_tag_0:item_tags!inner(tag_id),rule_tag_1:item_tags!inner(tag_id)",
    );
  });

  it("aliases are recognised as embed keys", () => {
    expect(isRuleEmbedKey(tagEmbedAlias(3))).toBe(true);
    expect(isRuleEmbedKey("title")).toBe(false);
  });
});

describe("applyRules on the real postgrest-js builder", () => {
  it("sends a single request whose query string carries every rule", async () => {
    const urls: URL[] = [];
    const client = createClient<Database>("http://localhost:54321", "test-key", {
      global: {
        fetch: async (input) => {
          urls.push(new URL(input instanceof Request ? input.url : String(input)));
          return new Response("[]", { headers: { "content-type": "application/json" } });
        },
      },
    });
    const query = client.from("items").select(ruleSelect("id", FULL));
    await applyRules(query, FULL, NOW);

    expect(urls).toHaveLength(1);
    const params = urls[0]!.searchParams;
    expect(params.get("select")).toBe(
      "id,rule_tag_0:item_tags!inner(tag_id),rule_tag_1:item_tags!inner(tag_id)",
    );
    expect(params.get("deleted_at")).toBe("is.null");
    expect(params.get("archived_at")).toBe("is.null");
    expect(params.get("kind")).toBe("in.(pdf,link)");
    expect(params.get("collection_id")).toBe(`in.(${COLLECTION_A},${COLLECTION_B})`);
    expect(params.get("rule_tag_0.tag_id")).toBe(`eq.${TAG_A}`);
    expect(params.get("rule_tag_1.tag_id")).toBe(`eq.${TAG_B}`);
    expect(params.get("domain")).toBe("in.(example.com)");
    expect(params.get("is_read")).toBe("eq.false");
    expect(params.get("is_favorite")).toBe("eq.true");
    expect(params.get("created_at")).toBe("gte.2026-03-03T12:00:00.000Z");
    expect(params.get("search")).toBe("wfts(simple).thesis notes");
  });
});

describe("describeRules", () => {
  const lookups = {
    collections: [{ id: COLLECTION_A, name: "Reading" }],
    tags: [{ id: TAG_A, name: "thesis" }],
  };

  it("is empty for no rules", () => {
    expect(describeRules({}, lookups)).toEqual([]);
  });

  it("names every rule", () => {
    expect(
      describeRules(
        {
          kinds: ["pdf"],
          collectionIds: [COLLECTION_A, COLLECTION_B],
          tagIds: [TAG_A],
          domains: ["a.com"],
          isRead: false,
          isFavorite: true,
          savedWithinDays: 7,
          query: "cats",
        },
        lookups,
      ),
    ).toEqual([
      "Kind: PDFs",
      "In: Reading, Unknown",
      "Tagged: #thesis",
      "From: a.com",
      "Unread",
      "Favorites",
      "Saved in the last 7 days",
      'Matching "cats"',
    ]);
  });

  it("uses the singular for one day", () => {
    expect(describeRules({ savedWithinDays: 1 }, lookups)).toEqual(["Saved in the last day"]);
  });
});

describe("parseDomainList", () => {
  it("splits, lower-cases, strips protocol, path and www, and removes duplicates", () => {
    expect(
      parseDomainList("Example.com, https://www.News.org/a/b?x=1  www.example.com;\nsub.site.io"),
    ).toEqual(["example.com", "news.org", "sub.site.io"]);
  });

  it("is empty for blank input", () => {
    expect(parseDomainList("  , ;\n")).toEqual([]);
  });
});
