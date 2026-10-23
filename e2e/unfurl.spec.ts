import { expect, test } from "@playwright/test";
import { readSession, startGuest, type AppSession } from "./helpers/session";
import { assertLocalUrl } from "./local-env";

// WP 3.2: the real /api/unfurl route against the local Supabase stack. This container has no
// outbound DNS, so only auth, validation, SSRF and rate-limit paths run here; real sites are
// covered by unit tests (local server + injected lookup) and checked on the deployed app.

/** Set by playwright.config.ts from the local stack (`e2e/local-env.ts`). */
function envValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run e2e through \`pnpm e2e\`.`);
  if (name === "NEXT_PUBLIC_SUPABASE_URL") assertLocalUrl(value);
  return value;
}

/** Writes `count` unfurl_log rows as the signed-in user through PostgREST (RLS applies). */
async function fillUnfurlLog(session: AppSession, count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    url: `https://example.com/seed-${index}`,
  }));
  const response = await fetch(`${envValue("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/unfurl_log`, {
    method: "POST",
    headers: {
      apikey: envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  expect(response.status, await response.clone().text()).toBe(201);
}

test.describe("POST /api/unfurl", () => {
  test("401 without a session", async ({ request }) => {
    const response = await request.post("/api/unfurl", { data: { url: "https://example.com/" } });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("a guest gets 400 for bad input and 422 for private or metadata addresses", async ({
    page,
  }) => {
    await startGuest(page);
    const unfurl = (data: unknown) => page.request.post("/api/unfurl", { data });

    for (const url of ["javascript:alert(1)", "ftp://example.com/", "not a url", ""]) {
      const response = await unfurl({ url });
      expect(response.status(), url).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_url" });
    }
    expect((await unfurl({})).status()).toBe(400);

    for (const url of [
      "http://127.0.0.1:54321/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://2130706433/",
      "http://localhost:3000/",
      "http://localhost/",
    ]) {
      const response = await unfurl({ url });
      expect(response.status(), url).toBe(422);
      expect(await response.json()).toEqual({ error: "blocked" });
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("429 with Retry-After after 60 requests in an hour", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    await fillUnfurlLog(session, 60);

    const response = await page.request.post("/api/unfurl", {
      data: { url: "http://127.0.0.1:54321/" },
    });
    expect(response.status()).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    const retryAfter = Number(response.headers()["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600);
  });
});
