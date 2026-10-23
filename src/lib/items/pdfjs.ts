// Loaded with a dynamic import so pdfjs stays out of the main bundle.
// The "legacy" build, not the modern one: pdfjs 6 calls Map.prototype.getOrInsertComputed (Chrome
// 145+, Firefox 144+) and Promise.withResolvers (Safari 17.4+), and only the legacy build
// polyfills them. Checked in Chromium 141, where the modern build throws on render.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

/** pdfjs with its worker pointed at the bundled asset. Shared by the thumbnail and the reader. */
export function getPdfjs(): typeof pdfjs {
  if (!workerConfigured) {
    // The bundler emits the worker as an asset and rewrites this URL.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}
