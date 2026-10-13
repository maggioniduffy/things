import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDailyCron } from "@/lib/cron/daily";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron runs must never be cached or prerendered.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/cron/daily - Vercel Cron (vercel.json). Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
 * Purges trash older than 30 days, orphaned storage folders and old `unfurl_log` rows.
 * Secrets are never logged and errors are generic.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // An unset or empty secret must never authorize anything.
  if (!secret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500, headers: NO_STORE });
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const result = await runDailyCron(createAdminClient());
    return NextResponse.json(result, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "cron_failed" }, { status: 500, headers: NO_STORE });
  }
}
