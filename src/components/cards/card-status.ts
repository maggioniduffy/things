"use client";

import { useEffect, useState } from "react";
import { getActiveMessages } from "@/i18n/active";
import { useT } from "@/i18n/client";
import type { BoardItem } from "@/lib/items/queries";
import { useUploadStore } from "@/stores/upload-store";
import type { CardProps } from "./types";

const NOTE_TITLE_MAX = 140;

export function itemDisplayTitle(item: BoardItem): string {
  const note = item.note?.trim() ?? "";
  const t = getActiveMessages().shell.card;
  const noteTitle =
    note.length > NOTE_TITLE_MAX ? `${note.slice(0, NOTE_TITLE_MAX).trimEnd()}…` : note;
  return (
    item.title ||
    item.url ||
    item.file_name ||
    noteTitle ||
    (item.kind === "note" ? t.emptyNote : t.untitled)
  );
}

/** An item still "pending" this long after its last update lost its enrichment (e.g. a reload). */
export const STALE_PENDING_MS = 2 * 60 * 1000;
/** How often a pending card re-checks whether it went stale. */
const STALE_CHECK_MS = 30 * 1000;

/**
 * True for a link or file whose enrichment can no longer be running: pending, last updated more
 * than two minutes ago, and (for files) not uploading in this tab. Link captures made in this tab
 * are always younger than that; a long upload is covered by `uploading`.
 */
export function isStalePending(item: BoardItem, now: number, uploading = false): boolean {
  if (item.enrich_status !== "pending" || uploading) return false;
  if (!item.url && !item.file_path) return false;
  const updatedAt = Date.parse(item.updated_at);
  return Number.isFinite(updatedAt) && now - updatedAt > STALE_PENDING_MS;
}

export type CardStatus = {
  /** Enrichment or upload is still running. */
  pending: boolean;
  /** Enrichment failed, or a pending item went stale. */
  failed: boolean;
  failedCopy: string;
  /** Wraps `onRetry` so the card shows its pending state while the retry runs. */
  retry: ((item: BoardItem) => Promise<void>) | undefined;
};

/** Capture status of a card: pending, failed (including stale pending) and the Retry action. */
export function useCardStatus(item: BoardItem, onRetry: CardProps["onRetry"]): CardStatus {
  const t = useT().shell.card;
  const [now, setNow] = useState(() => Date.now());
  const isPendingRow = item.enrich_status === "pending";
  // A pending card re-checks now and then, so a capture interrupted by a reload turns into Retry.
  useEffect(() => {
    if (!isPendingRow) return;
    const timer = setInterval(() => setNow(Date.now()), STALE_CHECK_MS);
    return () => clearInterval(timer);
  }, [isPendingRow]);
  const uploading = useUploadStore((state) => state.progress[item.id] !== undefined);
  // Retrying makes the item fresh again, but its cached `updated_at` is still old.
  const [retrying, setRetrying] = useState(false);
  const stale = !retrying && isStalePending(item, now, uploading);
  const retry = onRetry
    ? async (target: BoardItem) => {
        setRetrying(true);
        try {
          await onRetry(target);
        } finally {
          setRetrying(false);
        }
      }
    : undefined;
  return {
    pending: item.enrich_status === "pending" && !stale,
    failed: item.enrich_status === "failed" || stale,
    failedCopy: item.file_path ? t.uploadIncomplete : t.fetchFailed,
    retry,
  };
}
