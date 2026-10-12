import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { getSupabaseEnv } from "./env";

type AuthClaims = { is_anonymous?: boolean } | null;

/** True for `/app` and anything under `/app/`, but not `/apple`. */
function isAppPath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

/** Keeps only same-origin relative paths; anything else becomes null. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * Pure routing decision for the proxy: where to redirect, or null to continue.
 * Signed-out users are kept out of /app; signed-in (non-guest) users skip /login.
 * Anonymous guests may visit /login to sign in to a real account.
 */
export function resolveAuthRedirect({
  pathname,
  search,
  claims,
}: {
  pathname: string;
  search: string;
  claims: AuthClaims;
}): string | null {
  if (isAppPath(pathname) && !claims) {
    const next = safeNextPath(`${pathname}${search}`);
    return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  }
  if (pathname === "/login" && claims && !claims.is_anonymous) {
    return "/app";
  }
  return null;
}

/** Refreshes the Supabase session cookies and applies `resolveAuthRedirect`. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = getSupabaseEnv();

  let response = NextResponse.next({ request });
  let authHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        authHeaders = headers;
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Must run before the final response is built: it may refresh the session and call setAll.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const target = resolveAuthRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    claims,
  });

  if (target) {
    const redirect = NextResponse.redirect(new URL(target, request.nextUrl.origin));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(authHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
    return redirect;
  }

  return response;
}
