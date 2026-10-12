import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";
import { getSupabaseEnv } from "./env";

/** Supabase client for Server Components, Route Handlers and Server Actions. */
export async function createClient() {
  // Read cookies first: it marks the route as dynamic, so pages using this client are never
  // prerendered at build time (where the Supabase env may be absent, e.g. in CI's build job).
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot write cookies.
          // The proxy refreshes the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
