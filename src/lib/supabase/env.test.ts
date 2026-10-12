import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabaseEnv", () => {
  it("returns the validated public config", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(getSupabaseEnv()).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_test",
    });
  });

  it("names the missing URL variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/);
  });

  it("names the missing key variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing/);
  });

  it("rejects a URL that is not a URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is invalid/);
  });
});
