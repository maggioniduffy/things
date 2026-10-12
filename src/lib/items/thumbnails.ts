import type { ItemKind } from "@/types/supabase";

/** Thumbnails are at most this wide (CSS px of the source scale; cards show them smaller). */
export const THUMB_WIDTH = 480;
const THUMB_TYPE = "image/webp";
const THUMB_QUALITY = 0.8;
/** A video that has not produced a frame by now is skipped: the card falls back to its icon. */
const VIDEO_TIMEOUT_MS = 5000;

/** Fits (w, h) into `maxWidth` keeping the aspect ratio. Never upscales; integers >= 1. */
export function fitWidth(
  w: number,
  h: number,
  maxWidth: number = THUMB_WIDTH,
): { width: number; height: number } {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1, height: 1 };
  }
  const scale = w > maxWidth ? maxWidth / w : 1;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/** OffscreenCanvas when the browser has it, else a detached `<canvas>`. */
function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Encodes a canvas as WebP. Browsers that cannot encode WebP fall back to PNG, so callers should
 * read `blob.type` rather than assume.
 */
export async function encodeCanvas(canvas: AnyCanvas): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: THUMB_TYPE, quality: THUMB_QUALITY });
  }
  const element = canvas as HTMLCanvasElement;
  return new Promise<Blob | null>((resolve) =>
    element.toBlob((blob) => resolve(blob), THUMB_TYPE, THUMB_QUALITY),
  );
}

/** Draws a bitmap or video frame scaled into a fresh canvas and encodes it. */
async function drawAndEncode(
  source: ImageBitmap | HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number,
): Promise<Blob | null> {
  const { width, height } = fitWidth(sourceWidth, sourceHeight);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  return encodeCanvas(canvas);
}

async function imageThumbnail(file: File | Blob): Promise<Blob | null> {
  // SVGs are vector: the card shows the file itself, and rasterizing them is unreliable.
  if (file.type === "image/svg+xml") return null;
  const bitmap = await createImageBitmap(file);
  try {
    return await drawAndEncode(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

async function pdfThumbnail(file: File | Blob): Promise<Blob | null> {
  // Lazy: keeps pdfjs (and its worker) out of the main bundle until a PDF is actually saved.
  const { renderPdfFirstPage } = await import("./pdf-thumbnail");
  const canvas = await renderPdfFirstPage(await file.arrayBuffer(), THUMB_WIDTH);
  return encodeCanvas(canvas);
}

function videoThumbnail(file: File | Blob): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(blob);
    };
    const capture = () => {
      drawAndEncode(video, video.videoWidth, video.videoHeight).then(finish, () => finish(null));
    };

    const timer = setTimeout(() => finish(null), VIDEO_TIMEOUT_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("error", () => finish(null), { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        // Skip a black first frame when the clip is long enough; a very short clip uses its middle.
        const target = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 0) / 2);
        if (target > 0) {
          video.addEventListener("seeked", capture, { once: true });
          video.currentTime = target;
        } else {
          capture();
        }
      },
      { once: true },
    );
    video.src = objectUrl;
  });
}

/**
 * Makes a thumbnail (at most 480 px wide) for an image, PDF or video. Resolves to a WebP blob
 * (check `blob.type`: some browsers fall back to PNG), or `null` when the kind is unsupported or
 * anything goes wrong. Never throws: a missing thumbnail only means the card shows its icon.
 */
export async function createThumbnail(file: File | Blob, kind: ItemKind): Promise<Blob | null> {
  try {
    switch (kind) {
      case "image":
        return await imageThumbnail(file);
      case "pdf":
        return await pdfThumbnail(file);
      case "video":
        return await videoThumbnail(file);
      default:
        return null;
    }
  } catch {
    return null;
  }
}
