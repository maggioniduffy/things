"use client";

import { useEffect, useMemo, useRef } from "react";
import { useViewer } from "@/components/providers/viewer-provider";
import { markTourDone, needsTour } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/stores/ui-store";
import { TourDialog } from "./tour-dialog";

/**
 * The one tour dialog, driven by `ui-store` so the palette and the sidebar can replay it. When the
 * JWT claims say the account has not seen it (`needed`), the auth server is asked first, because
 * claims can be stale (another tab or device, a token issued before the write). If it is still
 * needed (or the check fails) the dialog opens and `tour_done_at` is written right away, once, so
 * a reload or a closed tab mid-tour never brings it back. Closing never writes; a replay never
 * writes either.
 */
export function TourHost({ needed }: { needed: boolean }) {
  const open = useUiStore((state) => state.tourOpen);
  const { isGuest } = useViewer();
  const client = useMemo(() => createClient(), []);
  const written = useRef(false);

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    void (async () => {
      let stillNeeded = true;
      try {
        const { data, error } = await client.auth.getUser();
        if (!error) stillNeeded = needsTour(data.user?.user_metadata);
      } catch {
        // fall back to the claims: open
      }
      if (cancelled || !stillNeeded) return;
      useUiStore.getState().setTourOpen(true);
      if (!written.current) {
        written.current = true;
        void markTourDone(client);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needed, client]);

  const close = () => useUiStore.getState().setTourOpen(false);

  return (
    <TourDialog
      open={open}
      onClose={close}
      isGuest={isGuest}
      onAddEmail={() => useUiStore.getState().setUpgradeOpen(true)}
    />
  );
}
