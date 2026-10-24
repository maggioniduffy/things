"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useT } from "@/i18n/client";
import type { BoardItem } from "@/lib/items/queries";
import { useFileDownload } from "./use-file-download";

const ON_DARK = "text-ink-inverse hover:bg-ink-inverse/10 hover:text-ink-inverse";

/**
 * Full-screen view of an image item over a dark, translucent backdrop: title, Download and Close
 * on top, the image fitted below. Clicking the backdrop or Escape closes it. A stored file
 * downloads under its own name; a remote image opens in a new tab (cross-origin images cannot be
 * downloaded from the page).
 */
export function ImageViewer({
  item,
  src,
  title,
  open,
  onOpenChange,
}: {
  item: BoardItem;
  src: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const copy = t.items.drawer;
  const { busy, download } = useFileDownload(item);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/85 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 fixed inset-0 z-50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 fixed inset-0 z-50 flex flex-col duration-(--duration-base) focus:outline-none"
          onClick={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
        >
          <div className="flex shrink-0 items-center gap-2 py-3 pr-3 pl-4">
            <DialogPrimitive.Title className="text-body text-ink-inverse min-w-0 flex-1 truncate font-medium">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {copy.fullSizeImage}
            </DialogPrimitive.Description>
            {item.file_path ? (
              <Button
                variant="ghost"
                size="sm"
                className={ON_DARK}
                disabled={busy}
                onClick={() => void download()}
              >
                <DownloadIcon />
                {copy.download}
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className={ON_DARK}>
                <a href={src} target="_blank" rel="noopener noreferrer" download>
                  <DownloadIcon />
                  {copy.download}
                </a>
              </Button>
            )}
            <DialogPrimitive.Close asChild>
              <IconButton
                variant="ghost"
                size="md"
                label={t.shell.ui.close}
                tooltip={false}
                className={ON_DARK}
              >
                <XIcon />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0"
            onClick={(event) => {
              if (event.target === event.currentTarget) onOpenChange(false);
            }}
          >
            {/* Signed or remote URL of unknown size: a plain img, like the cards. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={title}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
