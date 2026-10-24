"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import type { BoardItem } from "@/lib/items/queries";
import { BUCKET } from "@/lib/items/upload";
import { createClient } from "@/lib/supabase/client";

/** Downloads an item's stored file under its original name; a toast reports a failure. */
export function useFileDownload(item: BoardItem) {
  const t = useT().items.drawer;
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!item.file_path) return;
    setBusy(true);
    try {
      const { data, error } = await createClient()
        .storage.from(BUCKET)
        .createSignedUrl(item.file_path, 60, { download: item.file_name ?? true });
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      // The signed URL carries a Content-Disposition: attachment, so the page itself stays put.
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      toast.error(t.downloadFailed);
    } finally {
      setBusy(false);
    }
  }

  return { busy, download };
}
