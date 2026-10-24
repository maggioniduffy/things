"use client";

import { useEffect, useMemo, useRef } from "react";
import { useViewer } from "@/components/providers/viewer-provider";
import { markTourDone } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/stores/ui-store";
import { TourDialog } from "./tour-dialog";

/**
 * The one tour dialog, driven by `ui-store` so the palette and the sidebar can replay it. Opens on
 * mount when the account has not finished it (`needed`); Skip and Finish close it at once and
 * write `tour_done_at` once. A replay opens it again and never writes.
 */
export function TourHost({ needed }: { needed: boolean }) {
  const open = useUiStore((state) => state.tourOpen);
  const { isGuest } = useViewer();
  const client = useMemo(() => createClient(), []);
  const written = useRef(false);

  useEffect(() => {
    if (needed) useUiStore.getState().setTourOpen(true);
  }, [needed]);

  const close = () => {
    useUiStore.getState().setTourOpen(false);
    if (needed && !written.current) {
      written.current = true;
      void markTourDone(client);
    }
  };

  return (
    <TourDialog
      open={open}
      onClose={close}
      isGuest={isGuest}
      onAddEmail={() => useUiStore.getState().setUpgradeOpen(true)}
    />
  );
}
