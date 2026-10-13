"use client";

import { CardShell } from "./card-shell";
import { useCardStatus } from "./card-status";
import type { CardProps } from "./types";

/**
 * Note: a clamped text excerpt on a note surface, no thumbnail. A note without a title shows its
 * text as the title; with a title, the text follows as an excerpt.
 */
export function NoteCard({ item, variant, onOpen, onRetry }: CardProps) {
  const status = useCardStatus(item, onRetry);
  const text = item.note?.trim() ?? "";
  const hasTitle = Boolean(item.title);
  return (
    <CardShell
      card="note"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      surfaceClassName="bg-aurora-coral/20"
      title={hasTitle || !text ? undefined : text}
      titleClassName={
        hasTitle || !text ? "line-clamp-2" : "line-clamp-6 font-normal whitespace-pre-line"
      }
      body={
        hasTitle && text ? (
          <p className="text-body text-ink-muted line-clamp-4 [overflow-wrap:anywhere] whitespace-pre-line">
            {text}
          </p>
        ) : null
      }
    />
  );
}
