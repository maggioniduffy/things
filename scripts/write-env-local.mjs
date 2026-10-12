// Writes the local Supabase connection settings into .env.local (used by `pnpm db:env`, CI e2e).
// Reads `supabase status -o json`; never prints key values. Other lines already in .env.local are kept.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), ".env.local");

let raw;
try {
  raw = execFileSync("pnpm", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  console.error("db:env: `supabase status` failed. Is the local stack running (pnpm db:start)?");
  process.exit(1);
}

// The CLI can print log lines before the JSON object; parse from the first brace.
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start === -1 || end === -1) {
  console.error("db:env: `supabase status` returned no JSON.");
  process.exit(1);
}
const status = JSON.parse(raw.slice(start, end + 1));

const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
};

const missing = Object.entries(values)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) {
  console.error(`db:env: status output is missing values for ${missing.join(", ")}.`);
  process.exit(1);
}

// Keep unrelated lines (Turnstile key, CRON_SECRET, ...); replace or append ours.
const existing = existsSync(target) ? readFileSync(target, "utf8").split("\n") : [];
const kept = existing.filter(
  (line) => !Object.keys(values).some((key) => line.startsWith(`${key}=`)),
);
while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
const lines = [...kept, ...Object.entries(values).map(([key, value]) => `${key}=${value}`)];

writeFileSync(target, `${lines.join("\n")}\n`, { mode: 0o600 });
console.log(`db:env: wrote ${Object.keys(values).join(", ")} to .env.local`);
