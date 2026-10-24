"use client";

import { useUiStore } from "@/stores/ui-store";
import { UpgradeDialog } from "./upgrade-dialog";

/**
 * The one "Add email" dialog for a guest, driven by `ui-store` so the banner, the palette and
 * the quota toasts can open it. Mount it only for anonymous sessions (the /app layout checks).
 */
export function UpgradeHost() {
  const open = useUiStore((state) => state.upgradeOpen);
  const setOpen = useUiStore((state) => state.setUpgradeOpen);
  return <UpgradeDialog open={open} onOpenChange={setOpen} />;
}
