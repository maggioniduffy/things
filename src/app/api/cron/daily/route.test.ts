// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

// `server-only` throws outside a server bundle; the admin client is replaced below anyway.
vi.mock("server-only", () => ({}));

const runDailyCron = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cron/daily", () => ({ runDailyCron }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const RESULT = { purgedItems: 3, removedObjects: 5, orphanObjects: 2, unfurlLogRows: 7 };

function get(authorization?: string) {
  return GET(
    new Request("http://localhost/api/cron/daily", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  createAdminClient.mockReset();
  createAdminClient.mockReturnValue({ admin: true });
  runDailyCron.mockReset();
  runDailyCron.mockResolvedValue(RESULT);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/daily", () => {
  it("401 without an Authorization header, before doing any work", async () => {
    const response = await get();
    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(runDailyCron).not.toHaveBeenCalled();
  });

  it.each([["Bearer wrong"], ["s3cret"], ["Bearer "], ["Bearer s3cret2"]])(
    "401 for %j",
    async (header) => {
      const response = await get(header);
      expect(response.status).toBe(401);
      expect(runDailyCron).not.toHaveBeenCalled();
    },
  );

  it("500 when CRON_SECRET is unset, even for a header that looks empty-matching", async () => {
    vi.stubEnv("CRON_SECRET", "");
    for (const header of ["Bearer ", "Bearer", ""]) {
      const response = await get(header);
      expect(response.status).toBe(500);
    }
    expect((await get("Bearer s3cret")).status).toBe(500);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(runDailyCron).not.toHaveBeenCalled();
  });

  it("runs the purge with the right secret and returns the counts", async () => {
    const response = await get("Bearer s3cret");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(RESULT);
    expect(runDailyCron).toHaveBeenCalledWith({ admin: true });
  });

  it("500 with a generic body when the purge throws", async () => {
    runDailyCron.mockRejectedValue(new Error("secret internals"));
    const response = await get("Bearer s3cret");
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("secret internals");
    expect(JSON.parse(text)).toEqual({ error: "cron_failed" });
  });

  it("500 when the admin client cannot be created", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("Invalid admin Supabase environment");
    });
    const response = await get("Bearer s3cret");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "cron_failed" });
  });
});
