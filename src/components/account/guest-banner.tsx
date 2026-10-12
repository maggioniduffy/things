"use client";

import { XIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  dismissGuestBanner,
  getGuestBannerDismissed,
  guestBannerVariant,
  subscribeGuestBannerDismissed,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { UpgradeDialog } from "./upgrade-dialog";

const DEFAULT_COPY = "You're using Things as a guest. Add an email to keep your things.";

function reminderCopy(count: number) {
  return `You've saved ${count} things as a guest. Add an email so you don't lose them.`;
}

/** Counts the guest's saved items. Returns null when the query fails; the banner then keeps its default copy. */
async function fetchItemCount(): Promise<number | null> {
  try {
    const { count, error } = await createClient()
      .from("items")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
    return error ? null : count;
  } catch {
    return null;
  }
}

/**
 * Slim, persistent offer to keep a guest's things. Mount it only for anonymous sessions
 * (the /app layout checks). Dismissing hides it for this tab session only.
 */
export function GuestBanner() {
  const [count, setCount] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Server snapshot is "dismissed" so nothing flashes before the tab's stored choice is known.
  const dismissed = useSyncExternalStore(
    subscribeGuestBannerDismissed,
    getGuestBannerDismissed,
    () => true,
  );

  // Refetch on mount and whenever the window regains focus; there is no realtime in v1.
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void fetchItemCount().then((next) => {
        if (active) setCount(next);
      });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const variant = guestBannerVariant(count, dismissed);
  if (variant === "hidden") return null;

  return (
    <>
      <div
        role="region"
        aria-label="Guest account"
        className="border-line bg-surface relative z-10 border-b px-4 py-2 backdrop-blur-md sm:px-6"
      >
        <div className="flex items-center gap-x-3 gap-y-2">
          <p className="text-meta text-ink min-w-0 flex-1">
            {variant === "reminder" && count !== null ? reminderCopy(count) : DEFAULT_COPY}
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Keep my things
          </Button>
          <IconButton
            variant="ghost"
            size="sm"
            label="Dismiss for now"
            onClick={dismissGuestBanner}
          >
            <XIcon />
          </IconButton>
        </div>
      </div>
      <UpgradeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
