"use client";

import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { itemDisplayTitle, useCardStatus } from "@/components/cards/card-status";
import { Favicon } from "@/components/cards/card-media";
import { formatBytes } from "@/components/cards/format-bytes";
import { KindIcon } from "@/components/kind-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import type { BoardItem } from "@/lib/items/queries";
import type { ItemActions } from "@/lib/items/state-mutations";
import { createClient } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/items/upload";
import { NoteField } from "./fields";
import { parseVideoEmbed, safeHttpUrl } from "./urls";

const FRAME = "rounded-control border-line bg-line w-full overflow-hidden border";

/** A stored file whose upload is not complete: the object may not exist, so nothing is signed. */
function useUploadState(item: BoardItem): "ready" | "uploading" | "unfinished" | "none" {
  const { failed } = useCardStatus(item, undefined);
  if (!item.file_path) return "none";
  if (item.enrich_status === "done") return "ready";
  return failed ? "unfinished" : "uploading";
}

function UploadNotice({ item, state }: { item: BoardItem; state: "uploading" | "unfinished" }) {
  return (
    <div
      role="status"
      className={`${FRAME} text-ink-muted text-body grid min-h-40 place-items-center gap-2 p-6 text-center`}
    >
      <KindIcon kind={item.kind} className="text-ink-subtle size-6" />
      <p>{state === "uploading" ? "Uploading…" : "Upload didn't finish"}</p>
      {state === "unfinished" ? (
        <p className="text-meta text-ink-subtle">Move it to trash to clear it.</p>
      ) : null}
    </div>
  );
}

function ImagePreview({ item }: { item: BoardItem }) {
  const [open, setOpen] = useState(false);
  const urls = useSignedUrls([item.file_path]);
  const src = item.file_path ? urls.get(item.file_path) : item.image_url;
  const title = itemDisplayTitle(item);

  if (!src) {
    return item.file_path ? (
      <Skeleton className="aspect-[4/3] w-full" />
    ) : (
      <div className={`${FRAME} text-ink-subtle grid aspect-[4/3] place-items-center`}>
        <KindIcon kind="image" className="size-6" />
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label="View full size"
        onClick={() => setOpen(true)}
        className={`${FRAME} focus-visible:outline-ring block cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2`}
      >
        {/* Signed or remote URL of unknown size: a plain img, like the cards. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          referrerPolicy="no-referrer"
          className="max-h-[50vh] w-full object-contain"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">Full size image</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            referrerPolicy="no-referrer"
            className="max-h-[80dvh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PdfPreview({ item }: { item: BoardItem }) {
  const urls = useSignedUrls([item.file_path]);
  const src = item.file_path ? urls.get(item.file_path) : undefined;
  if (!src) return <Skeleton className="h-[60vh] w-full" />;
  return (
    <iframe src={src} title={`PDF: ${itemDisplayTitle(item)}`} className={`${FRAME} h-[60vh]`} />
  );
}

function VideoPreview({ item }: { item: BoardItem }) {
  const embed = parseVideoEmbed(item.url);
  const urls = useSignedUrls([embed ? null : item.file_path]);
  const fileSrc = item.file_path ? urls.get(item.file_path) : undefined;

  if (embed) {
    return (
      <iframe
        src={embed.src}
        title={`Video: ${itemDisplayTitle(item)}`}
        allow="fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={`${FRAME} aspect-video`}
      />
    );
  }
  if (item.file_path) {
    if (!fileSrc) return <Skeleton className="aspect-video w-full" />;
    return (
      <video
        src={fileSrc}
        controls
        preload="metadata"
        aria-label={itemDisplayTitle(item)}
        className={`${FRAME} bg-ink aspect-video`}
      />
    );
  }
  return <LinkPreview item={item} />;
}

function LinkPreview({ item }: { item: BoardItem }) {
  const href = safeHttpUrl(item.url);
  const site = item.site_name ?? item.domain;
  return (
    <div className={`${FRAME} bg-surface`}>
      {item.image_url ? (
        <div className="bg-line aspect-[1.91/1] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        </div>
      ) : null}
      <div className="grid gap-2 p-4">
        <div className="text-meta text-ink-muted flex items-center gap-2">
          <Favicon src={item.favicon_url} />
          {site ? <span className="truncate">{site}</span> : null}
        </div>
        <p className="text-card text-ink font-medium [overflow-wrap:anywhere]">
          {itemDisplayTitle(item)}
        </p>
        {item.description ? (
          <p className="text-body text-ink-muted [overflow-wrap:anywhere]">{item.description}</p>
        ) : null}
        {href ? (
          <Button asChild variant="secondary" size="sm" className="mt-1 w-fit">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              Open link
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilePreview({ item }: { item: BoardItem }) {
  const [busy, setBusy] = useState(false);
  const size = formatBytes(item.file_size);

  async function download() {
    if (!item.file_path) return;
    setBusy(true);
    try {
      const { data, error } = await createClient()
        .storage.from(BUCKET)
        .createSignedUrl(item.file_path, 60, { download: item.file_name ?? true });
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      // The signed URL carries a Content-Disposition: attachment, so the page itself stays put.
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Couldn't download that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${FRAME} bg-surface flex items-center gap-3 p-4`}>
      <KindIcon kind={item.kind} className="text-ink-subtle size-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-body text-ink truncate font-medium">
          {item.file_name ?? itemDisplayTitle(item)}
        </p>
        {size ? <p className="text-meta text-ink-subtle">{size}</p> : null}
      </div>
      {item.file_path ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void download()}>
          <DownloadIcon />
          Download
        </Button>
      ) : null}
    </div>
  );
}

/** The large preview of an item, by kind. */
export function ItemPreview({ item, actions }: { item: BoardItem; actions: ItemActions }) {
  const upload = useUploadState(item);
  if (upload === "uploading" || upload === "unfinished") {
    return <UploadNotice item={item} state={upload} />;
  }

  switch (item.kind) {
    case "image":
      return <ImagePreview item={item} />;
    case "pdf":
      return <PdfPreview item={item} />;
    case "video":
      return <VideoPreview item={item} />;
    case "link":
    case "article":
      return <LinkPreview item={item} />;
    case "note":
      return <NoteField item={item} actions={actions} />;
    case "document":
    case "audio":
    case "code":
    case "other":
      return <FilePreview item={item} />;
  }
}
