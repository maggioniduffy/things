"use client";

import { KindIcon } from "@/components/kind-icon";
import { CardShell } from "./card-shell";
import { useCardStatus } from "./card-status";
import { formatBytes } from "./format-bytes";
import type { CardProps } from "./types";

/** Documents, audio, code and other files: kind icon, file name and size. */
export function FileCard({ item, variant, onOpen, onRetry }: CardProps) {
  const status = useCardStatus(item, onRetry);
  const size = formatBytes(item.file_size);
  return (
    <CardShell
      card="file"
      item={item}
      variant={variant}
      status={status}
      onOpen={onOpen}
      titleClassName="line-clamp-2"
      media={
        <div className="bg-line text-ink-muted rounded-control grid size-10 place-items-center">
          <KindIcon kind={item.kind} className="size-5" />
        </div>
      }
      footer={size ? <p className="text-meta text-ink-subtle mt-auto">{size}</p> : null}
      listMeta={size}
    />
  );
}
