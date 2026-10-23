"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n/client";

/** Phones: iOS Safari shows only page 1 of a PDF in a frame and Android Chrome none at all. */
export const PHONE_PDF_QUERY = "(max-width: 639px), (pointer: coarse)";

const MAX_DPR = 2;
const DEFAULT_RATIO = 1.414;

function PdfPage({
  doc,
  index,
  total,
  width,
}: {
  doc: PDFDocumentProxy;
  index: number;
  total: number;
  width: number;
}) {
  const t = useT().items.drawer;
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const [ratio, setRatio] = useState(DEFAULT_RATIO);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void (async () => {
      try {
        const page = await doc.getPage(index + 1);
        const el = canvas.current;
        if (cancelled || !el) return;
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const viewport = page.getViewport({ scale: (width * dpr) / base.width });
        el.width = Math.max(1, Math.round(viewport.width));
        el.height = Math.max(1, Math.round(viewport.height));
        setRatio(base.height / base.width);
        const rendering = page.render({ canvas: el, viewport });
        task = rendering;
        await rendering.promise;
      } catch {
        // A cancelled render (unmount, resize) or one bad page: the page stays blank.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, index, width]);

  return (
    <div ref={holder} className="bg-surface w-full" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={t.pdfPage(index + 1, total)}
        className="block h-full w-full"
      />
    </div>
  );
}

/**
 * A PDF drawn page by page with pdf.js: stacked canvases, each rendered when it nears the
 * viewport. Pinch-zoom and scrolling are left to the browser.
 */
export function PdfPages({ src, className }: { src: string; className?: string }) {
  const t = useT().items.drawer;
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    void (async () => {
      try {
        const { getPdfjs } = await import("@/lib/items/pdfjs");
        const task = getPdfjs().getDocument({ url: src });
        destroy = () => task.destroy();
        const loaded = await task.promise;
        if (!cancelled) setDoc(loaded);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [src]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc, failed]);

  if (failed) {
    return (
      <div className="text-body text-ink-muted grid justify-items-start gap-3">
        <p>{t.viewerFailed}</p>
        <Button asChild variant="secondary" size="sm">
          <a href={src} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            {t.openFileInNewTab}
          </a>
        </Button>
      </div>
    );
  }
  if (!doc) return <Skeleton className={className ?? "h-[60vh] w-full"} />;

  return (
    <div ref={box} className={`grid content-start gap-2 overflow-y-auto ${className ?? ""}`}>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPage key={i} doc={doc} index={i} total={doc.numPages} width={width} />
      ))}
    </div>
  );
}
