import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/supabase";
import type { SortMode, ViewSpec } from "@/lib/views";
import {
  ITEM_COLUMNS,
  effectiveSort,
  PAGE_SIZE,
  fetchItemsPage,
  itemsInfiniteQueryOptions,
  itemsQueryKey,
  quotePostgrestValue,
  type BoardItem,
} from "./queries";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function makeRow(i: number, overrides: Partial<BoardItem> = {}): BoardItem {
  return {
    archived_at: null,
    canvas_h: null,
    canvas_w: null,
    canvas_x: null,
    canvas_y: null,
    canvas_z: 0,
    collection_id: null,
    created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}.123456+00:00`,
    deleted_at: null,
    description: null,
    domain: null,
    enrich_status: "done",
    favicon_url: null,
    file_name: null,
    file_path: null,
    file_size: null,
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    image_url: null,
    is_favorite: false,
    is_read: false,
    kind: "link",
    metadata: {},
    mime_type: null,
    note: null,
    position: `a${String(i).padStart(4, "0")}`,
    site_name: null,
    thumbnail_path: null,
    title: `Title ${i}`,
    updated_at: "2026-01-01T00:00:00+00:00",
    url: null,
    user_id: UUID_A,
    ...overrides,
  };
}

function setup(body: unknown = [], status = 200) {
  const urls: URL[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    urls.push(new URL(input instanceof Request ? input.url : String(input)));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createClient<Database>("http://localhost:54321", "test-key", {
    global: { fetch: fakeFetch },
  });
  return { client, urls };
}

async function params(view: ViewSpec, sort: SortMode = "manual", cursor = null as never) {
  const { client, urls } = setup([]);
  await fetchItemsPage(client, view, sort, cursor);
  expect(urls).toHaveLength(1);
  return urls[0]!.searchParams;
}

describe("quotePostgrestValue", () => {
  it.each([
    ["plain", '"plain"'],
    ["a,b", '"a,b"'],
    ["f(x)", '"f(x)"'],
    ['say "hi"', '"say \\"hi\\""'],
    ["back\\slash", '"back\\\\slash"'],
    ['\\"', '"\\\\\\""'],
    ["1.5.title", '"1.5.title"'],
    ["日本語 émoji 🎉", '"日本語 émoji 🎉"'],
    ["", '""'],
  ])("quotes %j", (input, expected) => {
    expect(quotePostgrestValue(input)).toBe(expected);
  });
});

describe("ITEM_COLUMNS", () => {
  it("excludes the search tsvector and lists real columns", () => {
    const cols = ITEM_COLUMNS.split(",");
    expect(cols).not.toContain("search");
    expect(cols).toContain("id");
    expect(cols).toContain("position");
    expect(cols).toHaveLength(Object.keys(makeRow(1)).length);
  });
});

describe("itemsQueryKey", () => {
  it("is [items, viewKey, sort]", () => {
    expect(itemsQueryKey({ type: "kind", kind: "pdf" }, "title")).toEqual([
      "items",
      "kind:pdf",
      "title",
    ]);
  });
});

describe("fetchItemsPage view filters", () => {
  it("selects explicit columns on the items table", async () => {
    const p = await params({ type: "all" });
    expect(p.get("select")).toBe(ITEM_COLUMNS);
    expect(p.get("limit")).toBe("51");
  });

  it("inbox", async () => {
    const p = await params({ type: "inbox" });
    expect(p.get("deleted_at")).toBe("is.null");
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("collection_id")).toBe("is.null");
  });

  it("all", async () => {
    const p = await params({ type: "all" });
    expect(p.get("deleted_at")).toBe("is.null");
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.has("collection_id")).toBe(false);
  });

  it("unread", async () => {
    const p = await params({ type: "unread" });
    expect(p.get("deleted_at")).toBe("is.null");
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("is_read")).toBe("eq.false");
  });

  it("favorites", async () => {
    const p = await params({ type: "favorites" });
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("is_favorite")).toBe("eq.true");
  });

  it("archive", async () => {
    const p = await params({ type: "archive" });
    expect(p.get("deleted_at")).toBe("is.null");
    expect(p.get("archived_at")).toBe("not.is.null");
  });

  it("trash", async () => {
    const p = await params({ type: "trash" });
    expect(p.get("deleted_at")).toBe("not.is.null");
    expect(p.has("archived_at")).toBe(false);
  });

  it("kind", async () => {
    const p = await params({ type: "kind", kind: "pdf" });
    expect(p.get("kind")).toBe("eq.pdf");
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("deleted_at")).toBe("is.null");
  });

  it("collection", async () => {
    const p = await params({ type: "collection", collectionId: UUID_A });
    expect(p.get("collection_id")).toBe(`eq.${UUID_A}`);
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("deleted_at")).toBe("is.null");
  });

  it("tag inner-joins item_tags", async () => {
    const p = await params({ type: "tag", tagId: UUID_B });
    expect(p.get("select")).toBe(`${ITEM_COLUMNS},item_tags!inner(tag_id)`);
    expect(p.get("item_tags.tag_id")).toBe(`eq.${UUID_B}`);
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("deleted_at")).toBe("is.null");
  });

  it("tag view strips the joined item_tags from results", async () => {
    const { client } = setup([{ ...makeRow(1), item_tags: [{ tag_id: UUID_B }] }]);
    const page = await fetchItemsPage(client, { type: "tag", tagId: UUID_B }, "manual", null);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty("item_tags");
    expect(page.items[0]).toEqual(makeRow(1));
  });
});

describe("fetchItemsPage smart views", () => {
  const TAG_A = "44444444-4444-4444-8444-444444444444";
  const TAG_B = "55555555-5555-4555-8555-555555555555";
  const view: ViewSpec = { type: "smart", viewId: UUID_A };

  /** Answers smart_views with `rules` (or no row) and items with `rows`. */
  function smartSetup(rules: unknown | undefined, rows: unknown[] = []) {
    const urls: URL[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      urls.push(url);
      const body = url.pathname.endsWith("/smart_views")
        ? rules === undefined
          ? []
          : [{ rules }]
        : rows;
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient<Database>("http://localhost:54321", "test-key", {
      global: { fetch: fakeFetch },
    });
    return { client, urls };
  }

  it("reads the view's rules, then one items request with the rules applied", async () => {
    const { client, urls } = smartSetup({ kinds: ["pdf"], isRead: false, tagIds: [TAG_A, TAG_B] });
    await fetchItemsPage(client, view, "newest", null);
    expect(urls).toHaveLength(2);
    expect(urls[0]!.pathname).toBe("/rest/v1/smart_views");
    expect(urls[0]!.searchParams.get("id")).toBe(`eq.${UUID_A}`);

    const items = urls[1]!;
    expect(items.pathname).toBe("/rest/v1/items");
    const p = items.searchParams;
    expect(p.get("select")).toBe(
      `${ITEM_COLUMNS},rule_tag_0:item_tags!inner(tag_id),rule_tag_1:item_tags!inner(tag_id)`,
    );
    expect(p.get("deleted_at")).toBe("is.null");
    expect(p.get("archived_at")).toBe("is.null");
    expect(p.get("kind")).toBe("in.(pdf)");
    expect(p.get("is_read")).toBe("eq.false");
    expect(p.get("rule_tag_0.tag_id")).toBe(`eq.${TAG_A}`);
    expect(p.get("rule_tag_1.tag_id")).toBe(`eq.${TAG_B}`);
    expect(p.get("limit")).toBe("51");
  });

  it("strips the embeds from the rows", async () => {
    const row = {
      ...makeRow(1),
      rule_tag_0: [{ tag_id: TAG_A }],
      item_tags: [{ tag_id: TAG_A }],
    };
    const { client } = smartSetup({ tagIds: [TAG_A] }, [row]);
    const page = await fetchItemsPage(client, view, "newest", null);
    expect(page.items).toEqual([makeRow(1)]);
  });

  it("a view that is gone shows an empty page without an items request", async () => {
    const { client, urls } = smartSetup(undefined, [makeRow(1)]);
    const page = await fetchItemsPage(client, view, "newest", null);
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(urls).toHaveLength(1);
  });

  it("invalid stored rules fall back to no rules (live items only)", async () => {
    const { client, urls } = smartSetup({ kinds: ["spreadsheet"] });
    await fetchItemsPage(client, view, "newest", null);
    const p = urls[1]!.searchParams;
    expect(p.get("select")).toBe(ITEM_COLUMNS);
    expect(p.get("kind")).toBeNull();
    expect(p.get("deleted_at")).toBe("is.null");
  });

  it("manual sort is not available: it shows newest first", async () => {
    const { client, urls } = smartSetup({});
    await fetchItemsPage(client, view, "manual", null);
    expect(urls[1]!.searchParams.get("order")).toBe("created_at.desc,id.desc");
    expect(effectiveSort(view, "manual")).toBe("newest");
    expect(effectiveSort(view, "title")).toBe("title");
    expect(effectiveSort({ type: "all" }, "manual")).toBe("manual");
    expect(itemsQueryKey(view, "manual")).toEqual(["items", `smart:${UUID_A}`, "newest"]);
  });

  it.each([
    ["newest", "created_at.lt."],
    ["oldest", "created_at.gt."],
    ["title", "title.gt."],
  ] as const)("keyset pagination keeps working in %s sort", async (sort, fragment) => {
    const { client, urls } = smartSetup({ isFavorite: true });
    await fetchItemsPage(client, view, sort, { value: "x", id: UUID_B });
    expect(urls[1]!.searchParams.get("or")).toContain(fragment);
    expect(urls[1]!.searchParams.get("is_favorite")).toBe("eq.true");
  });

  it("pages past the limit with a cursor", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => makeRow(i + 1));
    const { client } = smartSetup({}, rows);
    const page = await fetchItemsPage(client, view, "oldest", null, 2);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toEqual({ value: rows[1]!.created_at, id: rows[1]!.id });
  });
});

describe("fetchItemsPage sort and keyset", () => {
  const cases: { sort: SortMode; order: string; value: string; or: string }[] = [
    {
      sort: "manual",
      order: "position.asc,id.asc",
      value: "a0005",
      or: `position.gt."a0005",and(position.eq."a0005",id.gt."${UUID_A}")`,
    },
    {
      sort: "newest",
      order: "created_at.desc,id.desc",
      value: "2026-01-01T00:00:05.123456+00:00",
      or: `created_at.lt."2026-01-01T00:00:05.123456+00:00",and(created_at.eq."2026-01-01T00:00:05.123456+00:00",id.lt."${UUID_A}")`,
    },
    {
      sort: "oldest",
      order: "created_at.asc,id.asc",
      value: "2026-01-01T00:00:05.123456+00:00",
      or: `created_at.gt."2026-01-01T00:00:05.123456+00:00",and(created_at.eq."2026-01-01T00:00:05.123456+00:00",id.gt."${UUID_A}")`,
    },
    {
      sort: "title",
      order: "title.asc.nullslast,id.asc",
      value: 'Say "hi", (a.b)\\c',
      or: `title.gt."Say \\"hi\\", (a.b)\\\\c",and(title.eq."Say \\"hi\\", (a.b)\\\\c",id.gt."${UUID_A}"),title.is.null`,
    },
  ];

  it.each(cases)("$sort without a cursor orders and has no or", async ({ sort, order }) => {
    const p = await params({ type: "all" }, sort);
    expect(p.get("order")).toBe(order);
    expect(p.has("or")).toBe(false);
  });

  it.each(cases)("$sort with a cursor builds the keyset or", async ({ sort, order, value, or }) => {
    const { client, urls } = setup([]);
    await fetchItemsPage(client, { type: "all" }, sort, { value, id: UUID_A });
    const p = urls[0]!.searchParams;
    expect(p.get("order")).toBe(order);
    expect(p.get("or")).toBe(`(${or})`);
  });

  it("title null tail filters title is null and later ids", async () => {
    const { client, urls } = setup([]);
    await fetchItemsPage(client, { type: "all" }, "title", { value: null, id: UUID_A });
    const p = urls[0]!.searchParams;
    expect(p.get("title")).toBe("is.null");
    expect(p.get("id")).toBe(`gt.${UUID_A}`);
    expect(p.has("or")).toBe(false);
  });
});

describe("fetchItemsPage pagination", () => {
  it("returns no cursor for <= 50 rows", async () => {
    const rows = Array.from({ length: PAGE_SIZE }, (_, i) => makeRow(i));
    const { client } = setup(rows);
    const page = await fetchItemsPage(client, { type: "all" }, "manual", null);
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.nextCursor).toBeNull();
  });

  it("trims the 51st row and sets the cursor from the 50th", async () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => makeRow(i));
    const { client } = setup(rows);
    const page = await fetchItemsPage(client, { type: "all" }, "manual", null);
    expect(page.items).toHaveLength(PAGE_SIZE);
    const last = rows[PAGE_SIZE - 1]!;
    expect(page.nextCursor).toEqual({ value: last.position, id: last.id });
  });

  it.each([
    ["newest", "created_at"],
    ["oldest", "created_at"],
    ["title", "title"],
  ] as const)("cursor value for %s comes from %s", async (sort, column) => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => makeRow(i));
    const { client } = setup(rows);
    const page = await fetchItemsPage(client, { type: "all" }, sort, null);
    const last = rows[PAGE_SIZE - 1]!;
    expect(page.nextCursor).toEqual({ value: last[column], id: last.id });
  });

  it("cursor value is null when the last title is null", async () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => makeRow(i, { title: null }));
    const { client } = setup(rows);
    const page = await fetchItemsPage(client, { type: "all" }, "title", null);
    expect(page.nextCursor).toEqual({ value: null, id: rows[PAGE_SIZE - 1]!.id });
  });

  it("throws the PostgREST error", async () => {
    const { client } = setup({ code: "42501", message: "denied", details: null, hint: null }, 403);
    await expect(fetchItemsPage(client, { type: "all" }, "manual", null)).rejects.toMatchObject({
      message: "denied",
    });
  });
});

describe("itemsInfiniteQueryOptions", () => {
  it("wires key, initial param and next param", () => {
    const { client } = setup();
    const opts = itemsInfiniteQueryOptions(client, { type: "inbox" }, "newest");
    expect(opts.queryKey).toEqual(["items", "inbox", "newest"]);
    expect(opts.initialPageParam).toBeNull();
    const cursor = { value: "x", id: UUID_A };
    const getNext = opts.getNextPageParam as (
      p: unknown,
      all: unknown[],
      c: unknown,
      a: unknown[],
    ) => unknown;
    expect(getNext({ items: [], nextCursor: cursor }, [], null, [])).toEqual(cursor);
    expect(getNext({ items: [], nextCursor: null }, [], null, [])).toBeUndefined();
  });
});
