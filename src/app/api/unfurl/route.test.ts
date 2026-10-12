// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedUrlError, UnreachableError } from "@/lib/unfurl/fetch-safe";
import type { UnfurlResult } from "@/lib/unfurl/types";
import { POST } from "./route";

// `server-only` throws outside a server bundle; the real client is replaced below anyway.
vi.mock("server-only", () => ({}));

const unfurlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/unfurl/unfurl", () => ({ unfurl: unfurlMock }));

type Fake = {
  claims: object | null;
  count: number | null;
  countError: boolean;
  oldest: string | null;
  inserted: unknown[];
};
const state = vi.hoisted<{ current: Fake }>(() => ({
  current: { claims: {}, count: 0, countError: false, oldest: null, inserted: [] },
}));

// Just enough of the Supabase query builder for the two unfurl_log queries and the insert.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: state.current.claims }, error: null }) },
    from: () => ({
      select: (_columns: string, options?: { head?: boolean }) => {
        const builder = {
          gte: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({
            data: state.current.oldest ? { created_at: state.current.oldest } : null,
          }),
          then: (resolve: (value: unknown) => void) =>
            resolve(
              options?.head
                ? {
                    count: state.current.count,
                    error: state.current.countError ? { message: "x" } : null,
                  }
                : { data: [] },
            ),
        };
        return builder;
      },
      insert: async (row: unknown) => {
        state.current.inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

const RESULT: UnfurlResult = {
  url: "https://example.com/",
  finalUrl: "https://example.com/",
  canonicalUrl: null,
  title: "Example",
  description: null,
  siteName: null,
  imageUrl: null,
  faviconUrl: "https://example.com/favicon.ico",
  isArticle: false,
  provider: null,
  metadata: {},
};

function post(body: unknown, raw = false) {
  return POST(
    new Request("http://localhost/api/unfurl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.current = { claims: {}, count: 0, countError: false, oldest: null, inserted: [] };
  unfurlMock.mockReset();
  unfurlMock.mockResolvedValue(RESULT);
});

describe("POST /api/unfurl", () => {
  it("returns the unfurl result with no-store and logs the request", async () => {
    const response = await post({ url: "https://example.com/" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(RESULT);
    expect(state.current.inserted).toEqual([{ url: "https://example.com/" }]);
  });

  it("401 without a session, before doing any work", async () => {
    state.current.claims = null;
    const response = await post({ url: "https://example.com/" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(unfurlMock).not.toHaveBeenCalled();
    expect(state.current.inserted).toEqual([]);
  });

  it.each([
    ["javascript:alert(1)"],
    ["ftp://example.com/"],
    ["not a url"],
    [`https://example.com/${"a".repeat(2100)}`],
    [42],
    [undefined],
  ])("400 for %s", async (url) => {
    const response = await post({ url });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_url" });
    expect(unfurlMock).not.toHaveBeenCalled();
  });

  it("400 for a body that is not JSON", async () => {
    expect((await post("{nope", true)).status).toBe(400);
  });

  it("429 with Retry-After at 60 requests in the last hour, without logging or fetching", async () => {
    state.current.count = 60;
    state.current.oldest = new Date(Date.now() - 50 * 60 * 1000).toISOString();
    const response = await post({ url: "https://example.com/" });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(9 * 60);
    expect(retryAfter).toBeLessThanOrEqual(10 * 60);
    expect(state.current.inserted).toEqual([]);
    expect(unfurlMock).not.toHaveBeenCalled();
  });

  it("still allows the 60th request", async () => {
    state.current.count = 59;
    expect((await post({ url: "https://example.com/" })).status).toBe(200);
  });

  it("fails closed when the count cannot be read", async () => {
    state.current.countError = true;
    expect((await post({ url: "https://example.com/" })).status).toBe(502);
    expect(unfurlMock).not.toHaveBeenCalled();
  });

  it("422 when the SSRF guard blocks the URL", async () => {
    unfurlMock.mockRejectedValue(new BlockedUrlError());
    const response = await post({ url: "http://127.0.0.1:54321/" });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "blocked" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("502 when the page is unreachable or something unexpected fails", async () => {
    unfurlMock.mockRejectedValueOnce(new UnreachableError());
    expect((await post({ url: "https://example.com/" })).status).toBe(502);
    unfurlMock.mockRejectedValueOnce(new Error("boom"));
    const response = await post({ url: "https://example.com/" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "unreachable" });
  });
});
