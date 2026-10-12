// Loaded with a dynamic import from thumbnails.ts so pdfjs stays out of the main bundle.
// The "legacy" build, not the modern one: pdfjs 6 calls Map.prototype.getOrInsertComputed (Chrome
// 145+, Firefox 144+) and Promise.withResolvers (Safari 17.4+), and only the legacy build
// polyfills them. Checked in Chromium 141, where the modern build throws on render.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;
/** A pathological PDF must not leave the card's thumbnail step pending forever. */
const PDF_TIMEOUT_MS = 10_000;

/**
 * Renders page 1 of a PDF onto a canvas `width` px wide (the scale is width / page width at
 * scale 1). The caller encodes the canvas. Rejects on a broken or password-protected PDF.
 */
export async function renderPdfFirstPage(
  data: ArrayBuffer,
  width: number,
): Promise<HTMLCanvasElement> {
  if (!workerConfigured) {
    // The bundler emits the worker as an asset and rewrites this URL.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("PDF thumbnail timed out")), PDF_TIMEOUT_MS);
  });
  try {
    // Inside the try, so a broken PDF still destroys the task (and its worker).
    const rendering = render(task, width);
    // After a timeout the render rejects too (the task is destroyed); nobody awaits it then.
    rendering.catch(() => {});
    return await Promise.race([rendering, timeout]);
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}

async function render(
  task: ReturnType<typeof pdfjs.getDocument>,
  width: number,
): Promise<HTMLCanvasElement> {
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvas, viewport }).promise;
  return canvas;
}
