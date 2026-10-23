// Loaded with a dynamic import from thumbnails.ts so pdfjs stays out of the main bundle.
import { getPdfjs } from "./pdfjs";

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
  const pdfjs = getPdfjs();
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
  task: ReturnType<ReturnType<typeof getPdfjs>["getDocument"]>,
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
