import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/supabase";
import { ITEM_COLUMNS } from "./queries";
import { SEARCH_LIMIT, searchItems } from "./search";

function setup(body: unknown = [], status = 200) {
  const calls: { url: URL; body: unknown }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createClient<Database>("http://localhost:54321", "test-key", {
    global: { fetch: fakeFetch },
  });
  return { client, calls };
}

describe("searchItems", () => {
  it("calls search_items with cleaned rules and selects every column except search", async () => {
    const rows = [{ id: "a", title: "Canción" }];
    const { client, calls } = setup(rows);

    const items = await searchItems(client, "cancion", {
      kinds: ["note", "note"],
      domains: [" example.com ", "Not A Domain"],
      inbox: false,
      scope: "live",
    });

    expect(items).toEqual(rows);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url.pathname).toBe("/rest/v1/rpc/search_items");
    expect(call!.url.searchParams.get("select")).toBe(ITEM_COLUMNS);
    expect(call!.body).toEqual({
      q: "cancion",
      rules: { kinds: ["note"], domains: ["example.com"] },
      lim: SEARCH_LIMIT,
    });
  });

  it("passes a custom limit, the archived/trashed scope and inbox", async () => {
    const { client, calls } = setup([]);
    await searchItems(client, "", { scope: "trashed", inbox: true }, 8);
    expect(calls[0]!.body).toEqual({ q: "", rules: { scope: "trashed", inbox: true }, lim: 8 });
  });

  it("throws the PostgREST error", async () => {
    const { client } = setup({ message: "boom", code: "XX000" }, 500);
    await expect(searchItems(client, "x", {})).rejects.toMatchObject({ message: "boom" });
  });
});
