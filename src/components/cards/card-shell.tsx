"use client";

import { StarIcon } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { KindIcon } from "@/components/kind-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { kindSingularLabel } from "@/lib/kinds";
import type { BoardItem } from "@/lib/items/queries";
import { cn } from "@/lib/utils";
import { useUploadStore } from "@/stores/upload-store";
import { itemDisplayTitle, type CardStatus } from "./card-status";
import type { CardProps, CardType } from "./types";

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

/** Sits above the card's open button (z-20) so it stays clickable. */
function RetryButton({ item, retry }: { item: BoardItem; retry: CardStatus["retry"] }) {
  if (!retry || !item.url) return null;
  return (
    <Button variant="ghost" size="sm" className="relative z-20" onClick={() => void retry(item)}>
      Retry
    </Button>
  );
}

/** Favorite star and unread dot. Small, token-colored, announced to screen readers. */
function CardMarkers({ item }: { item: BoardItem }) {
  if (!item.is_favorite && item.is_read) return null;
  return (
    <span data-slot="card-markers" className="flex items-center gap-1.5">
      {item.is_favorite ? (
        <span role="img" aria-label="Favorite" className="text-aurora-coral flex">
          <StarIcon aria-hidden="true" className="size-3.5 fill-current" />
        </span>
      ) : null}
      {!item.is_read ? (
        <span
          role="img"
          aria-label="Unread"
          className="bg-aurora-blue size-2 shrink-0 rounded-full"
        />
      ) : null}
    </span>
  );
}

/**
 * Lets a wrapper (the sortable board) change how every card renders its root and add a drag
 * handle, without each per-kind card forwarding new props.
 */
export type CardChrome = {
  /** Root element; a sortable card sits in a wrapper `<li>` and renders a `<div>`. */
  as: "li" | "div";
  /** Reorder handle, placed above the open button. */
  dragHandle?: ReactNode;
};

export const CardChromeContext = createContext<CardChrome>({ as: "li" });

type CardShellProps = Omit<CardProps, "thumbnailUrl"> & {
  card: CardType;
  status: CardStatus;
  /** Grid only: thumbnail slot above the title. */
  media?: ReactNode;
  /** Replaces the display title (e.g. the full text of a note). */
  title?: ReactNode;
  titleClassName?: string;
  /** Grid only: content between the title and the footer. */
  body?: ReactNode;
  /** Grid only: shown at the bottom of a done card (domain, size, ...). */
  footer?: ReactNode;
  /** List only: trailing detail of a done row (domain, size, ...). */
  listMeta?: string | null;
  /** Extra classes for the grid card, e.g. tighter padding. */
  className?: string;
  /** Background class of the grid card; defaults to the shared surface token. */
  surfaceClassName?: string;
};

/**
 * Shared frame of every card: the grid tile or list row, the pending/failed footer, the markers
 * and the full-card open button. Renders an `<li>` (inside a `<ul>`) unless `CardChromeContext` says `div`.
 *
 * The first `<p>` child of a grid tile is its title (e2e relies on that).
 */
export function CardShell({
  card,
  item,
  variant,
  status,
  media,
  title,
  titleClassName,
  body,
  footer,
  listMeta,
  className,
  surfaceClassName,
  onOpen,
}: CardShellProps) {
  const { as: Root, dragHandle } = useContext(CardChromeContext);
  const displayTitle = itemDisplayTitle(item);
  const { pending, failed, failedCopy, retry } = status;
  // One accessible name per card; collapse line breaks of note titles.
  const openLabel = `Open ${displayTitle.replace(/\s+/g, " ")}`;

  if (variant === "list") {
    return (
      <Root
        data-slot="item-row"
        data-card={card}
        data-item-id={item.id}
        data-enrich-status={item.enrich_status}
        aria-busy={pending || undefined}
        className="group border-line hover:bg-accent relative flex min-h-12 items-center gap-3 border-b px-2 py-2.5 transition-colors duration-(--duration-fast)"
      >
        {dragHandle}
        <KindIcon kind={item.kind} className="text-ink-subtle size-4 shrink-0" />
        <span className="text-body text-ink min-w-0 flex-1 truncate">{displayTitle}</span>
        {pending ? <Skeleton className="hidden h-3 w-24 sm:block" /> : null}
        {failed ? (
          <>
            <span className="text-meta text-ink-subtle hidden sm:inline">{failedCopy}</span>
            <RetryButton item={item} retry={retry} />
          </>
        ) : listMeta ? (
          <span className="text-meta text-ink-subtle hidden max-w-48 truncate sm:inline">
            {listMeta}
          </span>
        ) : null}
        <CardMarkers item={item} />
        <Badge>{kindSingularLabel(item.kind)}</Badge>
        <button
          type="button"
          aria-label={openLabel}
          onClick={() => onOpen?.(item)}
          className="rounded-control absolute inset-0 z-10 cursor-pointer"
        />
      </Root>
    );
  }

  return (
    <Root
      data-slot="item-tile"
      data-card={card}
      data-item-id={item.id}
      data-enrich-status={item.enrich_status}
      aria-busy={pending || undefined}
      className={cn(
        "group rounded-card border-line shadow-card relative flex min-h-32 flex-col gap-2 border p-4 backdrop-blur-md",
        "ease-out-soft transition-[transform,box-shadow] duration-(--duration-fast)",
        "hover:shadow-card-hover motion-safe:hover:-translate-y-0.5",
        surfaceClassName ?? "bg-surface",
        className,
      )}
    >
      {dragHandle}
      {media}
      <div className="flex items-center justify-between gap-2">
        <Badge>{kindSingularLabel(item.kind)}</Badge>
        <CardMarkers item={item} />
      </div>
      <p
        className={cn(
          "text-card text-ink line-clamp-3 font-medium [overflow-wrap:anywhere]",
          titleClassName,
        )}
      >
        {title ?? displayTitle}
      </p>
      {body}
      {pending ? (
        <>
          <Skeleton className="h-3 w-2/3" />
          <UploadBar itemId={item.id} />
        </>
      ) : failed ? (
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-meta text-ink-subtle">{failedCopy}</p>
          <RetryButton item={item} retry={retry} />
        </div>
      ) : (
        footer
      )}
      <button
        type="button"
        aria-label={openLabel}
        onClick={() => onOpen?.(item)}
        className="rounded-card absolute inset-0 z-10 cursor-pointer"
      />
    </Root>
  );
}
