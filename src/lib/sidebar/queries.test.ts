import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/supabase";
import {
  collectionsQueryOptions,
  countsQueryOptions,
  smartViewsQueryOptions,
  tagsQueryOptions,
} from "./queries";

function setup(body: unknown, status = 200) {
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

// The fetchers ignore the TanStack context; call them directly.
type Fn = (ctx: never) => Promise<unknown>;
function run(opts: { queryFn?: unknown }) {
  return (opts.queryFn as Fn)({} as never);
}

describe("sidebar queries", () => {
  it("counts: key, select and summarized result", async () => {
    const { client, urls } = setup([
      {
        kind: "link",
        collection_id: null,
        is_read: false,
        is_favorite: false,
        archived: false,
        deleted: false,
        n: 4,
      },
    ]);
    const opts = countsQueryOptions(client);
    expect(opts.queryKey).toEqual(["counts"]);
    const result = (await run(opts)) as { inbox: number; all: number };
    expect(result.inbox).toBe(4);
    expect(result.all).toBe(4);
    expect(urls[0]!.pathname).toBe("/rest/v1/item_counts");
    expect(urls[0]!.searchParams.get("select")).toBe(
      "kind,collection_id,is_read,is_favorite,archived,deleted,n",
    );
  });

  it("collections", async () => {
    const { client, urls } = setup([]);
    const opts = collectionsQueryOptions(client);
    expect(opts.queryKey).toEqual(["collections"]);
    await run(opts);
    expect(urls[0]!.pathname).toBe("/rest/v1/collections");
    expect(urls[0]!.searchParams.get("select")).toBe("id,name,emoji,color,position");
    expect(urls[0]!.searchParams.get("order")).toBe("position.asc,id.asc");
  });

  it("tags", async () => {
    const { client, urls } = setup([]);
    const opts = tagsQueryOptions(client);
    expect(opts.queryKey).toEqual(["tags"]);
    await run(opts);
    expect(urls[0]!.pathname).toBe("/rest/v1/tags");
    expect(urls[0]!.searchParams.get("select")).toBe("id,name,color");
    expect(urls[0]!.searchParams.get("order")).toBe("name.asc");
  });

  it("smart views", async () => {
    const { client, urls } = setup([]);
    const opts = smartViewsQueryOptions(client);
    expect(opts.queryKey).toEqual(["smart-views"]);
    await run(opts);
    expect(urls[0]!.pathname).toBe("/rest/v1/smart_views");
    expect(urls[0]!.searchParams.get("select")).toBe("id,name,icon,position");
    expect(urls[0]!.searchParams.get("order")).toBe("position.asc,id.asc");
  });

  it.each([
    ["counts", countsQueryOptions],
    ["collections", collectionsQueryOptions],
    ["tags", tagsQueryOptions],
    ["smart views", smartViewsQueryOptions],
  ] as const)("%s throws the PostgREST error", async (_name, make) => {
    const { client } = setup({ code: "42501", message: "denied", details: null, hint: null }, 403);
    await expect(run(make(client))).rejects.toMatchObject({ message: "denied" });
  });
});
