import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { getSupabaseEnv } from "./env";

/** Browser Supabase client. `@supabase/ssr` returns a singleton in the browser. */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
