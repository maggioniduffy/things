import { execFileSync } from "node:child_process";

/**
 * The env every e2e run uses: the local Supabase stack from `supabase status`, never `.env.local`
 * (which may point at the cloud project). `pnpm build && pnpm start` would otherwise read
 * `.env.local`; values already in process.env win over Next's env files, so these reach both the
 * build and the server. Never prints key values.
 */
export function localE2eEnv(): Record<string, string> {
  let raw: string;
  try {
    raw = execFileSync("pnpm", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("e2e: `supabase status` failed. Start the local stack with `pnpm supabase start`.");
  }

  // The CLI can print log lines before the JSON object; parse from the first brace.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("e2e: `supabase status` returned no JSON.");
  const status = JSON.parse(raw.slice(start, end + 1)) as Record<string, string | undefined>;

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? "",
    SUPABASE_SECRET_KEY: status.SECRET_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY ?? "",
    // Local auth has no Google provider or captcha; empty values keep them off whatever .env.local says.
    NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: "",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    GOOGLE_AUTH_CLIENT_ID: "",
    GOOGLE_AUTH_CLIENT_SECRET: "",
    CRON_SECRET: "e2e-local-cron-secret",
  };

  const missing = Object.entries(env)
    .filter(([key, value]) => key.includes("SUPABASE") && !value)
    .map(([key]) => key);
  if (missing.length > 0) throw new Error(`e2e: supabase status is missing ${missing.join(", ")}.`);

  assertLocalUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  return env;
}

/** Refuses any Supabase URL that is not on this machine, so a test run can never touch production. */
export function assertLocalUrl(url: string) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(host)) {
    throw new Error(`e2e: refusing to run against a non-local Supabase (${host}).`);
  }
}
