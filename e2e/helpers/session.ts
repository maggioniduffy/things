import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/** Playwright does not load .env.local the way Next does, so read the generated file directly. */
function readEnvLocal(): Record<string, string> {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const entries = text
      .split("\n")
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1] ?? "", (match[2] ?? "").replace(/^["']|["']$/g, "")] as const);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

const envLocal = readEnvLocal();

function requireEnv(name: string): string {
  const value = process.env[name] || envLocal[name];
  if (!value) throw new Error(`${name} is not set. Run \`pnpm db:env\` first.`);
  return value;
}

const SUPABASE_URL = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const PUBLISHABLE_KEY = () => requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

/** The local stack's public URL and publishable key, for specs that build their own client. */
export function supabasePublicEnv() {
  return { url: SUPABASE_URL(), publishableKey: PUBLISHABLE_KEY() };
}

export type AppSession = {
  accessToken: string;
  user: { id: string; email?: string; is_anonymous?: boolean };
};

type StoredSession = {
  access_token?: string;
  user?: { id: string; email?: string; is_anonymous?: boolean };
};

/**
 * Decodes the Supabase auth cookie (`sb-<ref>-auth-token`), which `@supabase/ssr` may split into
 * `.0`, `.1`, ... chunks and may prefix with `base64-` (base64url JSON).
 */
export function decodeAuthCookie(cookies: { name: string; value: string }[]): AppSession | null {
  const matching = cookies.filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
  if (matching.length === 0) return null;

  const whole = matching.find((cookie) => !/\.\d+$/.test(cookie.name));
  const raw = whole
    ? whole.value
    : matching
        .filter((cookie) => /\.\d+$/.test(cookie.name))
        .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()))
        .map((cookie) => cookie.value)
        .join("");

  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Not URI-encoded; use as is.
  }
  const json = text.startsWith("base64-")
    ? Buffer.from(text.slice("base64-".length), "base64url").toString("utf8")
    : text;

  const parsed = JSON.parse(json) as StoredSession;
  if (!parsed.access_token || !parsed.user) return null;
  return { accessToken: parsed.access_token, user: parsed.user };
}

/** The session the app itself holds in the browser, read from its auth cookie. */
export async function readSession(context: BrowserContext): Promise<AppSession> {
  const session = decodeAuthCookie(await context.cookies());
  if (!session) throw new Error("No Supabase session cookie in this browser context.");
  return session;
}

function restHeaders(session: AppSession) {
  return {
    apikey: PUBLISHABLE_KEY(),
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

/** Inserts `count` notes as the signed-in user through PostgREST, with RLS applying as in the app. */
export async function createNotes(session: AppSession, count: number, prefix = "Note") {
  const rows = Array.from({ length: count }, (_, index) => ({
    kind: "note",
    title: `${prefix} ${index + 1}`,
    note: `Saved by e2e (${prefix} ${index + 1})`,
    position: `a${String(index).padStart(3, "0")}`,
  }));
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/items`, {
    method: "POST",
    headers: { ...restHeaders(session), Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  expect(response.status, await response.clone().text()).toBe(201);
}

export type SeedItem = {
  kind: string;
  title?: string | null;
  url?: string;
  domain?: string;
  file_name?: string;
  collection_id?: string | null;
  is_favorite?: boolean;
  is_read?: boolean;
  /** ISO timestamps; set to move the item to Archive or Trash. */
  archived_at?: string;
  deleted_at?: string;
};

let seedCounter = 0;

/**
 * Inserts items of chosen kinds/states as the signed-in user (RLS applies, like `createNotes`).
 * Positions are generated in call order. Returns the inserted rows' ids and titles.
 */
export async function seedItems(session: AppSession, items: SeedItem[]) {
  // One request per row: PostgREST bulk inserts need identical keys in every object.
  const inserted: { id: string; title: string | null }[] = [];
  for (const item of items) {
    const response = await fetch(`${SUPABASE_URL()}/rest/v1/items`, {
      method: "POST",
      headers: { ...restHeaders(session), Prefer: "return=representation" },
      body: JSON.stringify({ ...item, position: `s${String(seedCounter++).padStart(6, "0")}` }),
    });
    expect(response.status, await response.clone().text()).toBe(201);
    inserted.push(...((await response.json()) as { id: string; title: string | null }[]));
  }
  return inserted;
}

/** Creates a collection for the signed-in user and returns its id. */
export async function createCollection(
  session: AppSession,
  name: string,
  emoji: string | null = null,
): Promise<string> {
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/collections`, {
    method: "POST",
    headers: { ...restHeaders(session), Prefer: "return=representation" },
    body: JSON.stringify({ name, emoji, position: `c${String(seedCounter++).padStart(6, "0")}` }),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const rows = (await response.json()) as { id: string }[];
  const id = rows[0]?.id;
  if (!id) throw new Error("Collection insert returned no row.");
  return id;
}

/** Creates a tag for the signed-in user, attaches it to `itemIds` and returns the tag id. */
export async function tagItems(
  session: AppSession,
  name: string,
  itemIds: string[],
): Promise<string> {
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/tags`, {
    method: "POST",
    headers: { ...restHeaders(session), Prefer: "return=representation" },
    body: JSON.stringify({ name }),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const tagId = ((await response.json()) as { id: string }[])[0]?.id;
  if (!tagId) throw new Error("Tag insert returned no row.");

  const links = await fetch(`${SUPABASE_URL()}/rest/v1/item_tags`, {
    method: "POST",
    headers: { ...restHeaders(session), Prefer: "return=minimal" },
    body: JSON.stringify(itemIds.map((itemId) => ({ item_id: itemId, tag_id: tagId }))),
  });
  expect(links.status, await links.clone().text()).toBe(201);
  return tagId;
}

/** Titles of the signed-in user's items, oldest first. */
export async function listItemTitles(session: AppSession): Promise<string[]> {
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/items?select=title&order=position`, {
    headers: restHeaders(session),
  });
  expect(response.status).toBe(200);
  const rows = (await response.json()) as { title: string }[];
  return rows.map((row) => row.title);
}

/** `GET /auth/v1/user` with the session's access token: what the server believes about the user. */
export async function fetchAuthUser(session: AppSession) {
  const response = await fetch(`${SUPABASE_URL()}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY(), Authorization: `Bearer ${session.accessToken}` },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { id: string; email?: string; is_anonymous?: boolean };
}

/** Landing page -> "Try without an account" -> /app, with the guest banner showing. */
export async function startGuest(page: Page) {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Try without an account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(guestBanner(page)).toBeVisible();
}

/** Sidebar footer: "Guest" or the signed-in email. */
export function accountGroup(page: Page) {
  return page.getByRole("group", { name: "Account" });
}

export function guestBanner(page: Page) {
  return page.getByRole("region", { name: "Guest account" });
}

/**
 * Uploads `bytes` random bytes to the `things` bucket at `<user id>/<name>` through the Storage API,
 * as the signed-in user — the same path the app's upload pipeline will use. Returns the HTTP status.
 */
export async function uploadBytes(
  session: AppSession,
  name: string,
  bytes: number,
  { upsert = false }: { upsert?: boolean } = {},
): Promise<number> {
  const response = await fetch(
    `${SUPABASE_URL()}/storage/v1/object/things/${session.user.id}/${name}`,
    {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY(),
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/octet-stream",
        ...(upsert ? { "x-upsert": "true" } : {}),
      },
      body: new Uint8Array(bytes),
    },
  );
  await response.arrayBuffer();
  return response.status;
}
