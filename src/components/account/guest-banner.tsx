"use client";

import { XIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  dismissGuestBanner,
  getGuestBannerDismissed,
  guestBannerVariant,
  subscribeGuestBannerDismissed,
} from "@/lib/auth";
import { countsQueryOptions } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { UpgradeDialog } from "./upgrade-dialog";

const DEFAULT_COPY = "You're using Thingteca as a guest. Add an email to keep your things.";

function reminderCopy(count: number) {
  return `You've saved ${count} things as a guest. Add an email so you don't lose them.`;
}

/**
 * Slim, persistent offer to keep a guest's things. Mount it only for anonymous sessions
 * (the /app layout checks). Dismissing hides it for this tab session only.
 */
export function GuestBanner() {
  // Everything not trashed. Shares the sidebar's counts query, so a capture (which bumps the
  // counts optimistically) moves the reminder right away; null until known or if the query fails.
  const counts = useQuery(countsQueryOptions(createClient()));
  const count = counts.data ? counts.data.all + counts.data.archive : null;
  const [dialogOpen, setDialogOpen] = useState(false);

  // Server snapshot is "dismissed" so nothing flashes before the tab's stored choice is known.
  const dismissed = useSyncExternalStore(
    subscribeGuestBannerDismissed,
    getGuestBannerDismissed,
    () => true,
  );

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
