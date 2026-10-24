import { describe, expect, it } from "vitest";
import {
  mergeSearchRules,
  parseSearchParams,
  searchParamsHref,
  type BoardSearch,
} from "./search-params";

const TAG_A = "11111111-1111-4111-8111-111111111111";
const TAG_B = "22222222-2222-4222-8222-222222222222";

function search(overrides: Partial<BoardSearch> = {}): BoardSearch {
  return { q: "", kinds: [], tagIds: [], domains: [], statuses: [], ...overrides };
}

describe("parseSearchParams", () => {
  it("is null with no q and no chips", () => {
    expect(parseSearchParams(new URLSearchParams("sort=title&item=x"))).toBeNull();
    expect(parseSearchParams(new URLSearchParams("q=%20%20"))).toBeNull();
    expect(parseSearchParams(undefined)).toBeNull();
  });

  it("reads q, trimmed and with collapsed spaces", () => {
    expect(parseSearchParams(new URLSearchParams("q=%20canci%C3%B3n%20%20de%20cuna "))?.q).toBe(
      "canción de cuna",
    );
  });

  it("reads comma-separated kinds and drops unknown ones", () => {
    expect(parseSearchParams(new URLSearchParams("kind=pdf,bogus,note,pdf"))?.kinds).toEqual([
      "pdf",
      "note",
    ]);
  });

  it("reads tag ids and drops non-uuids", () => {
    expect(parseSearchParams(new URLSearchParams(`tag=${TAG_A},nope,${TAG_B}`))?.tagIds).toEqual([
      TAG_A,
      TAG_B,
    ]);
  });

  it("reads domains in the stored form and drops invalid ones", () => {
    expect(
      parseSearchParams(new URLSearchParams("domain=Example.com,www.foo.org,bad domain!,"))
        ?.domains,
    ).toEqual(["example.com", "foo.org", "bad"]);
  });

  it("reads statuses and drops unknown ones", () => {
    expect(
      parseSearchParams(new URLSearchParams("status=unread,weird,favorite"))?.statuses,
    ).toEqual(["unread", "favorite"]);
    expect(parseSearchParams(new URLSearchParams("status=weird"))).toBeNull();
  });

  it("reads the server's searchParams object, first value of an array", () => {
    expect(parseSearchParams({ q: ["a", "b"], kind: "note", sort: "title" })).toEqual(
      search({ q: "a", kinds: ["note"] }),
    );
  });
});

describe("searchParamsHref", () => {
  it("writes the params and keeps sort and item", () => {
    const href = searchParamsHref(
      "/app/all",
      "sort=title&item=abc",
      search({ q: "cancion", kinds: ["note", "pdf"], statuses: ["favorite"] }),
    );
    const [path, query] = href.split("?");
    expect(path).toBe("/app/all");
    const params = new URLSearchParams(query);
    expect(params.get("sort")).toBe("title");
    expect(params.get("item")).toBe("abc");
    expect(params.get("q")).toBe("cancion");
    expect(params.get("kind")).toBe("note,pdf");
    expect(params.get("status")).toBe("favorite");
  });

  it("round-trips through parseSearchParams", () => {
    const value = search({
      q: "pan & más",
      kinds: ["note"],
      tagIds: [TAG_A],
      domains: ["example.com"],
      statuses: ["unread", "favorite"],
    });
    const href = searchParamsHref("/app", "sort=newest", value);
    expect(parseSearchParams(new URLSearchParams(href.split("?")[1]))).toEqual(value);
  });

  it("clears the search params only, with null", () => {
    expect(searchParamsHref("/app", "q=x&kind=note&tag=y&sort=title&item=1", null)).toBe(
      "/app?sort=title&item=1",
    );
    expect(searchParamsHref("/app", new URLSearchParams("q=x&status=read"), null)).toBe("/app");
  });
});

describe("mergeSearchRules", () => {
  it("passes the view's scope, inbox, collection and saved-within rules through", () => {
    expect(mergeSearchRules({ scope: "trashed" }, search({ q: "a" }))).toEqual({
      scope: "trashed",
    });
    expect(mergeSearchRules({ scope: "archived" }, search({ q: "a" }))).toEqual({
      scope: "archived",
    });
    expect(
      mergeSearchRules(
        { inbox: true, collectionIds: [TAG_A], savedWithinDays: 7, query: "x" },
        search({ q: "a" }),
      ),
    ).toEqual({ inbox: true, collectionIds: [TAG_A], savedWithinDays: 7, query: "x" });
  });

  it("uses the chip kinds when the view has none, and intersects otherwise", () => {
    expect(mergeSearchRules({}, search({ kinds: ["note", "pdf"] }))).toEqual({
      kinds: ["note", "pdf"],
    });
    expect(
      mergeSearchRules({ kinds: ["note", "pdf"] }, search({ kinds: ["pdf", "link"] })),
    ).toEqual({ kinds: ["pdf"] });
  });

  it("is empty when kinds do not intersect", () => {
    expect(mergeSearchRules({ kinds: ["pdf"] }, search({ kinds: ["note"] }))).toBe("empty");
  });

  it("intersects domains and is empty when they do not overlap", () => {
    expect(mergeSearchRules({}, search({ domains: ["a.com"] }))).toEqual({ domains: ["a.com"] });
    expect(
      mergeSearchRules({ domains: ["a.com", "b.com"] }, search({ domains: ["b.com", "c.com"] })),
    ).toEqual({ domains: ["b.com"] });
    expect(mergeSearchRules({ domains: ["a.com"] }, search({ domains: ["c.com"] }))).toBe("empty");
  });

  it("unions tag ids", () => {
    expect(mergeSearchRules({ tagIds: [TAG_A] }, search({ tagIds: [TAG_A, TAG_B] }))).toEqual({
      tagIds: [TAG_A, TAG_B],
    });
  });

  it("maps status to isRead and isFavorite", () => {
    expect(mergeSearchRules({}, search({ statuses: ["unread"] }))).toEqual({ isRead: false });
    expect(mergeSearchRules({}, search({ statuses: ["read"] }))).toEqual({ isRead: true });
    expect(mergeSearchRules({}, search({ statuses: ["favorite"] }))).toEqual({ isFavorite: true });
  });

  it("is empty when status contradicts itself or the view", () => {
    expect(mergeSearchRules({}, search({ statuses: ["unread", "read"] }))).toBe("empty");
    expect(mergeSearchRules({ isRead: false }, search({ statuses: ["read"] }))).toBe("empty");
    expect(mergeSearchRules({ isRead: false }, search({ statuses: ["unread"] }))).toEqual({
      isRead: false,
    });
    expect(mergeSearchRules({ isFavorite: false }, search({ statuses: ["favorite"] }))).toBe(
      "empty",
    );
    expect(mergeSearchRules({ isFavorite: true }, search({ statuses: ["favorite"] }))).toEqual({
      isFavorite: true,
    });
  });
});
