"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearBrowserQueryClient } from "@/lib/query-client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
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

  return (
    <Button variant="secondary" size="sm" onClick={signOut} disabled={pending}>
      Sign out
    </Button>
  );
}
