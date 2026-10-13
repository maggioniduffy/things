"use client";

import { PlayIcon } from "lucide-react";
import { CardMedia } from "./card-media";
import { CardShell } from "./card-shell";
import { useCardStatus } from "./card-status";
import type { CardProps } from "./types";

function PlayGlyph() {
  return (
    <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
      <span className="bg-ink/70 text-paper grid size-10 place-items-center rounded-full">
        <PlayIcon className="size-4 fill-current" />
      </span>
    </span>
  );
}

/** Video: thumbnail with a play glyph, title, provider. */
export function VideoCard({ item, variant, thumbnailUrl, onOpen, onRetry }: CardProps) {
  const status = useCardStatus(item, onRetry);
  const provider = item.site_name || item.domain;
  return (
    <CardShell
      card="video"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      media={
        <CardMedia
          src={thumbnailUrl ?? item.image_url}
          kind="video"
          pending={status.pending}
          placeholder
          aspectClassName="aspect-video"
          overlay={<PlayGlyph />}
        />
      }
      footer={
        provider ? <p className="text-meta text-ink-subtle mt-auto truncate">{provider}</p> : null
      }
      listMeta={provider}
    />
  );
}
