import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BlockedUrlError } from "@/lib/unfurl/fetch-safe";
import type { UnfurlErrorBody, UnfurlErrorCode, UnfurlResult } from "@/lib/unfurl/types";
import { unfurl } from "@/lib/unfurl/unfurl";

// Unfurls per user per rolling hour (counted from `unfurl_log` under RLS).
const HOURLY_LIMIT = 60;
const HOUR_MS = 60 * 60 * 1000;
// `{ "url": <2048 chars> }` fits easily; anything bigger is not a valid request.
const MAX_BODY_CHARS = 4096;

const bodySchema = z.object({
  url: z
    .string()
    .max(2048)
    .pipe(z.url({ protocol: /^https?$/ })),
});

const STATUS: Record<UnfurlErrorCode, number> = {
  invalid_url: 400,
  unauthorized: 401,
  rate_limited: 429,
  blocked: 422,
  unreachable: 502,
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fail(code: UnfurlErrorCode, headers?: Record<string, string>) {
  return NextResponse.json<UnfurlErrorBody>(
    { error: code },
    { status: STATUS[code], headers: { "Cache-Control": "no-store", ...headers } },
  );
}

/**
 * POST /api/unfurl  { url }  ->  UnfurlResult
 * Needs a Supabase session (guests count). The SSRF guard lives in `lib/unfurl/fetch-safe`.
 * Nothing about the requested URL is logged here.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return fail("unauthorized");

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_CHARS) return fail("invalid_url");
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_CHARS) return fail("invalid_url");
  const parsed = bodySchema.safeParse(parseJson(text));
  if (!parsed.success) return fail("invalid_url");
  const { url } = parsed.data;

  // Rate limit: count this user's log rows in the last hour (RLS scopes the query to them).
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("unfurl_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  // Fail closed: without a count the limit cannot be enforced.
  if (countError) return fail("unreachable");
  if ((count ?? 0) >= HOURLY_LIMIT) {
    // The oldest row in the window leaving it is what frees a slot.
    const { data: oldest } = await supabase
      .from("unfurl_log")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const freesAt = oldest ? new Date(oldest.created_at).getTime() + HOUR_MS : Date.now() + HOUR_MS;
    const retryAfter = Math.max(1, Math.ceil((freesAt - Date.now()) / 1000));
    return fail("rate_limited", { "Retry-After": String(retryAfter) });
  }

  // user_id defaults to auth.uid(); the row is written before fetching so failures still count.
  const { error: logError } = await supabase.from("unfurl_log").insert({ url });
  if (logError) return fail("unreachable");

  try {
    const result = await unfurl(url);
    return NextResponse.json<UnfurlResult>(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BlockedUrlError) return fail("blocked");
    // UnreachableError, and anything unexpected: never echo error details to the client.
    return fail("unreachable");
  }
}
