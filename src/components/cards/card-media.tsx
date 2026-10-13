"use client";

import { useState, type ReactNode } from "react";
import { KindIcon } from "@/components/kind-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ItemKind } from "@/types/supabase";

type CardMediaProps = {
  src: string | null | undefined;
  /** Kind icon of the placeholder shown when there is no image. */
  kind: ItemKind;
  /** The item is still being captured: an empty media slot shows a skeleton. */
  pending: boolean;
  /** Reserve the slot (placeholder or skeleton) even without an image. */
  placeholder: boolean;
  /** Tailwind aspect-ratio class of the slot. */
  aspectClassName: string;
  /** Extra classes for the image, e.g. `object-top`. */
  imgClassName?: string;
  /** Drawn above the image, e.g. the video play glyph. */
  overlay?: ReactNode;
};

/**
 * Thumbnail slot of a grid card. The image scales 1.02 on card hover (the card is a `group`),
 * only when the user has not asked for reduced motion.
 */
export function CardMedia({
  src,
  kind,
  pending,
  placeholder,
  aspectClassName,
  imgClassName,
  overlay,
}: CardMediaProps) {
  if (!src) {
    if (!placeholder) return null;
    if (pending) return <Skeleton className={cn("w-full", aspectClassName)} />;
    return (
      <div
        className={cn(
          "bg-line text-ink-subtle rounded-control relative grid w-full place-items-center",
          aspectClassName,
        )}
      >
        <KindIcon kind={kind} className="size-6" />
        {overlay}
      </div>
    );
  }
  return (
    <div className={cn("bg-line rounded-control relative w-full overflow-hidden", aspectClassName)}>
      {/* Remote or signed URLs of unknown size: a plain img keeps this independent of next/image config. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        // Remote preview images: don't tell third-party hosts which page they were shown on.
        referrerPolicy="no-referrer"
        draggable={false}
        className={cn(
          "ease-out-soft size-full object-cover transition-transform duration-(--duration-fast) motion-safe:group-hover:scale-[1.02]",
          imgClassName,
        )}
      />
      {overlay}
    </div>
  );
}

/** Small site icon; disappears if the remote icon fails to load. */
export function Favicon({ src }: { src: string | null | undefined }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailedSrc(src)}
      className="rounded-control size-4 shrink-0 object-contain"
    />
  );
}
