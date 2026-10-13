"use client";

import { CardMedia } from "./card-media";
import { CardShell } from "./card-shell";
import { useCardStatus } from "./card-status";
import { formatBytes } from "./format-bytes";
import type { CardProps } from "./types";

/** PDF: page-1 thumbnail, title and size. The kind badge reads "PDF". */
export function PdfCard({ item, variant, thumbnailUrl, onOpen, onRetry }: CardProps) {
  const status = useCardStatus(item, onRetry);
  const size = formatBytes(item.file_size);
  return (
    <CardShell
      card="pdf"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      media={
        <CardMedia
          src={thumbnailUrl ?? item.image_url}
          kind="pdf"
          pending={status.pending}
          placeholder
          aspectClassName="aspect-[4/3]"
          imgClassName="object-top"
        />
      }
      footer={size ? <p className="text-meta text-ink-subtle mt-auto">{size}</p> : null}
      listMeta={size}
    />
  );
}
