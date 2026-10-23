import { defineConfig, devices } from "@playwright/test";
import { localE2eEnv } from "./e2e/local-env";

// Workers load this config again; they inherit the parent's env, so `supabase status` runs once.
if (!process.env.E2E_LOCAL_ENV) {
  Object.assign(process.env, localE2eEnv(), { E2E_LOCAL_ENV: "1" });
}
const supabaseEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" &&
      /^(NEXT_PUBLIC_SUPABASE_|SUPABASE_|NEXT_PUBLIC_AUTH_GOOGLE|NEXT_PUBLIC_TURNSTILE|GOOGLE_AUTH_|CRON_SECRET)/.test(entry[0]),
  ),
);

const port = 3000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Local containers may ship a different Chromium build; CI uses the downloaded one.
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
        },
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Local Supabase only (see e2e/local-env.ts). /styleguide is dev-only; STYLEGUIDE keeps it
    // reachable in the production build under test.
    env: { ...supabaseEnv, STYLEGUIDE: "1" },
    timeout: 180_000,
  },
});
