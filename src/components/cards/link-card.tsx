"use client";

import { CardMedia, Favicon } from "./card-media";
import { CardShell } from "./card-shell";
import { useCardStatus } from "./card-status";
import type { CardProps } from "./types";

/** Link and article: preview image (if any), title, then favicon, site name and domain. */
export function LinkCard({ item, variant, thumbnailUrl, onOpen, onRetry }: CardProps) {
  const status = useCardStatus(item, onRetry);
  const site = item.site_name && item.site_name !== item.domain ? item.site_name : null;
  const hasSource = Boolean(item.favicon_url || site || item.domain);
  return (
    <CardShell
      card="link"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      media={
        <CardMedia
          src={thumbnailUrl ?? item.image_url}
          kind={item.kind}
          pending={status.pending}
          placeholder={false}
          aspectClassName="aspect-video"
        />
      }
      footer={
        hasSource ? (
          <div className="text-meta text-ink-subtle mt-auto flex min-w-0 items-center gap-1.5">
            <Favicon src={item.favicon_url} />
            {site ? <span className="truncate">{site}</span> : null}
            {item.domain ? <span className="truncate">{item.domain}</span> : null}
          </div>
        ) : null
      }
      listMeta={item.domain}
    />
  );
}
