"use client";

import { ExternalLinkIcon, MaximizeIcon } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import { useT } from "@/i18n/client";
import type { BoardItem } from "@/lib/items/queries";

type ViewerKind = "pdf" | "markdown" | "text";

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const TEXT_EXTENSIONS = new Set(["txt", "csv"]);

function extensionOf(name: string | null): string {
  if (!name) return "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** How an item's file can be read inside the app, or null when it can only be downloaded. */
export function viewerKindOf(item: BoardItem): ViewerKind | null {
  if (!item.file_path) return null;
  if (item.kind === "pdf") return "pdf";
  const extension = extensionOf(item.file_name ?? item.file_path);
  if (MARKDOWN_EXTENSIONS.has(extension) || item.mime_type === "text/markdown") return "markdown";
  if (TEXT_EXTENSIONS.has(extension) || item.mime_type?.startsWith("text/")) return "text";
  return null;
}

function useFileText(src: string | undefined) {
  return useQuery({
    queryKey: ["file-text", src],
    enabled: Boolean(src),
    queryFn: async () => {
      const response = await fetch(src as string);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      return response.text();
    },
  });
}

function FileText({ src, markdown }: { src: string | undefined; markdown: boolean }) {
  const t = useT().items.drawer;
  const { data, isError } = useFileText(src);
  if (isError) return <p className="text-body text-ink-muted">{t.viewerFailed}</p>;
  if (data === undefined) return <Skeleton className="h-full min-h-40 w-full" />;
  if (!markdown) {
    return (
      <pre className="text-body text-ink font-mono [overflow-wrap:anywhere] whitespace-pre-wrap">
        {data}
      </pre>
    );
  }
  return (
    <div className="text-body text-ink grid max-w-3xl gap-3 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:font-mono [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {data}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Full-view reader for an item's file: PDFs in a native frame, Markdown rendered, plain text as is.
 * Plus, for PDFs, a way out to a browser tab (the browser's own viewer, with its toolbar).
 */
export function FileViewerButton({ item, kind }: { item: BoardItem; kind: ViewerKind }) {
  const t = useT().items.drawer;
  const card = useT().shell.card;
  const [open, setOpen] = useState(false);
  const urls = useSignedUrls([open || kind === "pdf" ? item.file_path : null]);
  const src = item.file_path ? urls.get(item.file_path) : undefined;
  const title = itemDisplayTitle(item, card);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <MaximizeIcon />
        {t.openFullView}
      </Button>
      {kind === "pdf" && src ? (
        <Button asChild variant="secondary" size="sm">
          <a href={src} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            {t.openFileInNewTab}
          </a>
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] sm:max-w-[calc(100%-2rem)]">
          <DialogTitle className="truncate pr-8">{title}</DialogTitle>
          <DialogDescription className="sr-only">{t.fullViewDescription}</DialogDescription>
          <div className="min-h-0 overflow-auto">
            {kind === "pdf" ? (
              src ? (
                <iframe src={src} title={t.pdfTitle(title)} className="size-full" />
              ) : (
                <Skeleton className="h-full w-full" />
              )
            ) : (
              <FileText src={src} markdown={kind === "markdown"} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
