"use client";

import { CardMedia } from "./card-media";
import { CardShell } from "./card-shell";
import { useCardStatus } from "./card-status";
import type { CardProps } from "./types";

/** Image: the picture dominates the card, the title is small. */
export function ImageCard({ item, variant, thumbnailUrl, onOpen, onRetry }: CardProps) {
  const status = useCardStatus(item, onRetry);
  return (
    <CardShell
      card="image"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      className="p-2"
      titleClassName="text-meta text-ink-muted line-clamp-1 px-1 font-normal"
      media={
        <CardMedia
          src={thumbnailUrl ?? item.image_url}
          kind="image"
          pending={status.pending}
          placeholder
          aspectClassName="aspect-[4/3]"
        />
      }
    />
  );
}
