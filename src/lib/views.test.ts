import { describe, expect, it } from "vitest";
import {
  ITEM_KINDS,
  SORT_MODES,
  parseSort,
  parseView,
  viewHref,
  viewKey,
  type ViewSpec,
} from "./views";

const ID = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const ID2 = "0b9e7a42-1d3c-4f58-8a6e-2b4c6d8e0f12";

const segmentsOf = (href: string) => href.split("/").filter(Boolean).slice(1);

describe("parseView", () => {
  const valid: [string, string[] | undefined, ViewSpec][] = [
    ["/app (undefined)", undefined, { type: "inbox" }],
    ["/app (empty)", [], { type: "inbox" }],
    ["/app/all", ["all"], { type: "all" }],
    ["/app/unread", ["unread"], { type: "unread" }],
    ["/app/favorites", ["favorites"], { type: "favorites" }],
    ["/app/archive", ["archive"], { type: "archive" }],
    ["/app/trash", ["trash"], { type: "trash" }],
    ["/app/f/pdf", ["f", "pdf"], { type: "kind", kind: "pdf" }],
    ["/app/c/<uuid>", ["c", ID], { type: "collection", collectionId: ID }],
    ["/app/t/<uuid>", ["t", ID], { type: "tag", tagId: ID }],
    ["/app/v/<uuid>", ["v", ID], { type: "smart", viewId: ID }],
  ];

  it.each(valid)("parses %s", (_name, segments, expected) => {
    expect(parseView(segments)).toEqual(expected);
  });

  it.each(ITEM_KINDS)("accepts kind %s", (kind) => {
    expect(parseView(["f", kind])).toEqual({ type: "kind", kind });
  });

  const invalid: [string, string[]][] = [
    ["unknown word", ["settings"]],
    ["inbox is not a route", ["inbox"]],
    ["wrong case", ["All"]],
    ["extra segment after system view", ["all", "x"]],
    ["extra segment after kind", ["f", "pdf", "x"]],
    ["extra segment after collection", ["c", ID, "x"]],
    ["bad uuid (collection)", ["c", "not-a-uuid"]],
    ["bad uuid (tag)", ["t", "123"]],
    ["bad uuid (smart view)", ["v", ID.slice(0, -1)]],
    ["bad kind", ["f", "spreadsheet"]],
    ["f without kind", ["f"]],
    ["c without id", ["c"]],
    ["t without id", ["t"]],
    ["v without id", ["v"]],
    ["unknown prefix", ["x", ID]],
    ["empty segment", [""]],
  ];

  it.each(invalid)("rejects %s", (_name, segments) => {
    expect(parseView(segments)).toBeNull();
  });
});

describe("viewHref / viewKey", () => {
  const views: ViewSpec[] = [
    { type: "inbox" },
    { type: "all" },
    { type: "unread" },
    { type: "favorites" },
    { type: "archive" },
    { type: "trash" },
    ...ITEM_KINDS.map((kind): ViewSpec => ({ type: "kind", kind })),
    { type: "collection", collectionId: ID },
    { type: "tag", tagId: ID2 },
    { type: "smart", viewId: ID },
  ];

  it("builds the documented hrefs", () => {
    expect(viewHref({ type: "inbox" })).toBe("/app");
    expect(viewHref({ type: "all" })).toBe("/app/all");
    expect(viewHref({ type: "kind", kind: "pdf" })).toBe("/app/f/pdf");
    expect(viewHref({ type: "collection", collectionId: ID })).toBe(`/app/c/${ID}`);
    expect(viewHref({ type: "tag", tagId: ID })).toBe(`/app/t/${ID}`);
    expect(viewHref({ type: "smart", viewId: ID })).toBe(`/app/v/${ID}`);
  });

  it.each(views.map((v) => [viewHref(v), v] as const))("round-trips %s", (href, view) => {
    expect(parseView(segmentsOf(href))).toEqual(view);
  });

  it("builds stable, unique keys", () => {
    expect(viewKey({ type: "inbox" })).toBe("inbox");
    expect(viewKey({ type: "kind", kind: "pdf" })).toBe("kind:pdf");
    expect(viewKey({ type: "collection", collectionId: ID })).toBe(`collection:${ID}`);
    expect(viewKey({ type: "tag", tagId: ID })).toBe(`tag:${ID}`);
    expect(viewKey({ type: "smart", viewId: ID })).toBe(`smart:${ID}`);
    const keys = views.map(viewKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("ITEM_KINDS", () => {
  it("lists every kind once, in sidebar order", () => {
    expect([...ITEM_KINDS]).toEqual([
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
    ]);
  });
});

describe("parseSort", () => {
  it.each(SORT_MODES)("accepts %s", (mode) => {
    expect(parseSort(mode)).toBe(mode);
  });

  it("falls back to manual when missing or invalid", () => {
    expect(parseSort(undefined)).toBe("manual");
    expect(parseSort("")).toBe("manual");
    expect(parseSort("random")).toBe("manual");
    expect(parseSort("NEWEST")).toBe("manual");
    expect(parseSort([])).toBe("manual");
  });

  it("uses the first value of an array", () => {
    expect(parseSort(["title", "newest"])).toBe("title");
    expect(parseSort(["bogus", "newest"])).toBe("manual");
  });
});
