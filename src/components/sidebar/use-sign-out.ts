"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearBrowserQueryClient } from "@/lib/query-client";
import { createClient } from "@/lib/supabase/client";

/** Signs the user out, wipes the in-memory cache and returns to the landing page. */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await createClient().auth.signOut();
    // Nothing from this account may render for whoever signs in next in this tab.
    clearBrowserQueryClient();
    router.replace("/");
    router.refresh();
  }

  return { signOut, pending };
}
