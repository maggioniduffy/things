import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "@/i18n/server";
import { isAccountConflict } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/supabase/proxy";

/**
 * OAuth (and PKCE) landing point: exchanges `?code=` for a session, then redirects to a safe `next`.
 * Provider errors (`?error=`, `?error_description=`) and failed exchanges go to /login?error=callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  const failure = (reason?: "account_exists") => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "callback");
    if (reason) url.searchParams.set("reason", reason);
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  if (searchParams.get("error") || searchParams.get("error_description")) {
    // linkIdentity on a Google account that belongs to another user: `error_code=identity_already_exists`.
    return failure(
      isAccountConflict({ code: searchParams.get("error_code") }) ? "account_exists" : undefined,
    );
  }

  const code = searchParams.get("code");
  if (!code) return failure();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failure();

  // Auth emails pick their language from user_metadata.locale; keep it in step with this site.
  const locale = await getLocale();
  if (data.user?.user_metadata?.locale !== locale) {
    await supabase.auth.updateUser({ data: { locale } }).catch(() => {});
  }

  return NextResponse.redirect(new URL(next ?? "/app", origin));
}
