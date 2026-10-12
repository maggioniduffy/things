"use client";

import { useEffect, useState } from "react";
import { KindIcon } from "@/components/kind-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { kindSingularLabel } from "@/lib/kinds";
import type { BoardItem } from "@/lib/items/queries";
import { useUploadStore } from "@/stores/upload-store";

export type ItemTileVariant = "grid" | "list";

const NOTE_TITLE_MAX = 140;

export function itemDisplayTitle(item: BoardItem): string {
  const note = item.note?.trim() ?? "";
  const noteTitle =
    note.length > NOTE_TITLE_MAX ? `${note.slice(0, NOTE_TITLE_MAX).trimEnd()}…` : note;
  return item.title || item.url || item.file_name || noteTitle || "Untitled";
}

/** An item still "pending" this long after its last update lost its enrichment (e.g. a reload). */
export const STALE_PENDING_MS = 2 * 60 * 1000;
/** How often a pending tile re-checks whether it went stale. */
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

type ItemTileProps = {
  item: BoardItem;
  variant: ItemTileVariant;
  /** Signed storage URL of the item's thumbnail; falls back to the unfurled `image_url`. */
  thumbnailUrl?: string | null;
  /** Called by the Retry button of a link whose details could not be fetched. */
  onRetry?: (item: BoardItem) => void | Promise<void>;
};

/** Thin bar for a file upload: determinate when progress is known, otherwise a static partial fill. */
function UploadBar({ itemId }: { itemId: string }) {
  const progress = useUploadStore((state) => state.progress[itemId]);
  if (progress === undefined) return null;

  const percent =
    progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : null;
  return (
    <div
      role="progressbar"
      aria-label="Uploading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="bg-line h-1 w-full overflow-hidden rounded-full"
    >
      <div
        className="bg-ink-muted h-full rounded-full"
        style={{ width: percent === null ? "33%" : `${percent}%` }}
      />
    </div>
  );
}

function RetryButton({ item, onRetry }: { item: BoardItem; onRetry?: ItemTileProps["onRetry"] }) {
  if (!onRetry || !item.url) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => void onRetry(item)}>
      Retry
    </Button>
  );
}

/**
 * Placeholder for the Phase 4 cards: title, kind, domain and the capture status, no links or
 * drawer yet. Renders an `<li>`, so it must sit inside a `<ul>`.
 */
export function ItemTile({ item, variant, thumbnailUrl, onRetry }: ItemTileProps) {
  const title = itemDisplayTitle(item);
  const [now, setNow] = useState(() => Date.now());
  const isPendingRow = item.enrich_status === "pending";
  // A pending tile re-checks now and then, so a capture interrupted by a reload turns into Retry.
  useEffect(() => {
    if (!isPendingRow) return;
    const timer = setInterval(() => setNow(Date.now()), STALE_CHECK_MS);
    return () => clearInterval(timer);
  }, [isPendingRow]);
  const uploading = useUploadStore((state) => state.progress[item.id] !== undefined);
  // Retrying makes the item fresh again, but its cached `updated_at` is still old.
  const [retrying, setRetrying] = useState(false);
  const stale = !retrying && isStalePending(item, now, uploading);
  const failedCopy = item.file_path ? "Upload didn't finish" : "Couldn't fetch details";
  const pending = item.enrich_status === "pending" && !stale;
  const failed = item.enrich_status === "failed" || stale;
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
  const imageUrl = thumbnailUrl ?? item.image_url;

  if (variant === "list") {
    return (
      <li
        data-slot="item-row"
        data-item-id={item.id}
        data-enrich-status={item.enrich_status}
        aria-busy={pending || undefined}
        className="border-line flex min-h-12 items-center gap-3 border-b py-2.5"
      >
        <KindIcon kind={item.kind} className="text-ink-subtle size-4 shrink-0" />
        <span className="text-body text-ink min-w-0 flex-1 truncate">{title}</span>
        {pending ? <Skeleton className="hidden h-3 w-24 sm:block" /> : null}
        {failed ? (
          <>
            <span className="text-meta text-ink-subtle hidden sm:inline">{failedCopy}</span>
            <RetryButton item={item} onRetry={retry} />
          </>
        ) : item.domain ? (
          <span className="text-meta text-ink-subtle hidden max-w-48 truncate sm:inline">
            {item.domain}
          </span>
        ) : null}
        <Badge>{kindSingularLabel(item.kind)}</Badge>
      </li>
    );
  }

  return (
    <li
      data-slot="item-tile"
      data-item-id={item.id}
      data-enrich-status={item.enrich_status}
      aria-busy={pending || undefined}
      className="rounded-card border-line bg-surface shadow-card flex min-h-32 flex-col gap-2 border p-4 backdrop-blur-md"
    >
      {imageUrl ? (
        // Remote or signed URLs of unknown size: a plain img keeps this independent of next/image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          // Remote preview images: don't tell third-party hosts which page they were shown on.
          referrerPolicy="no-referrer"
          draggable={false}
          className="bg-line rounded-control aspect-video w-full object-cover"
        />
      ) : null}
      <Badge>{kindSingularLabel(item.kind)}</Badge>
      <p
        className={`text-card text-ink line-clamp-3 font-medium [overflow-wrap:anywhere] ${
          item.kind === "note" ? "whitespace-pre-line" : ""
        }`}
      >
        {title}
      </p>
      {pending ? (
        <>
          <Skeleton className="h-3 w-2/3" />
          <UploadBar itemId={item.id} />
        </>
      ) : failed ? (
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-meta text-ink-subtle">{failedCopy}</p>
          <RetryButton item={item} onRetry={retry} />
        </div>
      ) : item.domain ? (
        <p className="text-meta text-ink-subtle mt-auto truncate">{item.domain}</p>
      ) : null}
    </li>
  );
}
