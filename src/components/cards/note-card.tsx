"use client";

import { noteColorStyle } from "@/lib/items/note-colors";
import { cn } from "@/lib/utils";
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
  const style = noteColorStyle(item.color);
  return (
    <CardShell
      card="note"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      surfaceClassName={style.surfaceClassName}
      inverse={style.inverse}
      title={hasTitle || !text ? undefined : text}
      titleClassName={
        hasTitle || !text ? "line-clamp-2" : "line-clamp-6 font-normal whitespace-pre-line"
      }
      body={
        hasTitle && text ? (
          <p
            className={cn(
              "text-body line-clamp-4 [overflow-wrap:anywhere] whitespace-pre-line",
              style.inverse ? "text-ink-inverse-muted" : "text-ink-muted",
            )}
          >
            {text}
          </p>
        ) : null
      }
    />
  );
}
