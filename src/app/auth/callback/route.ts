import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/supabase/proxy";

/**
 * OAuth (and PKCE) landing point: exchanges `?code=` for a session, then redirects to a safe `next`.
 * Provider errors (`?error=`, `?error_description=`) and failed exchanges go to /login?error=callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  const failure = () => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "callback");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  if (searchParams.get("error") || searchParams.get("error_description")) return failure();

  const code = searchParams.get("code");
  if (!code) return failure();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failure();

  return NextResponse.redirect(new URL(next ?? "/app", origin));
}
