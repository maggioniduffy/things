import { readDataTransfer, type CaptureRequest } from "@/components/capture/clipboard";

/** The clipboard could not be read: permission was denied or the browser has no clipboard API. */
export class ClipboardDeniedError extends Error {
  constructor() {
    super("Clipboard access denied");
    this.name = "ClipboardDeniedError";
  }
}

type ClipboardItemLike = {
  readonly types: readonly string[];
  getType(type: string): Promise<Blob>;
};

/** The slice of `navigator.clipboard` we read, so tests can pass a plain object. */
export type ClipboardLike = {
  read?: () => Promise<readonly ClipboardItemLike[]>;
  readText?: () => Promise<string>;
};

function extensionOf(mime: string): string {
  const subtype = mime.split("/")[1] ?? "bin";
  return subtype.split("+")[0] || "bin";
}

/** Every image, link list and text on the clipboard, shaped like a paste's `DataTransfer`. */
async function transferFromItems(items: readonly ClipboardItemLike[]) {
  const files: File[] = [];
  const text: Record<string, string> = {};
  for (const item of items) {
    for (const type of item.types) {
      if (type.startsWith("image/")) {
        const blob = await item.getType(type);
        files.push(new File([blob], `image.${extensionOf(type)}`, { type }));
      } else if (type === "text/uri-list" || type === "text/plain") {
        text[type] ??= await (await item.getType(type)).text();
      }
    }
  }
  return { files, getData: (format: string) => text[format] ?? "" };
}

/**
 * What the clipboard holds as save requests, by the same rules as a paste (`readDataTransfer`):
 * images become files, a URL list or a text of URLs becomes links, other text becomes a note.
 * Tries `clipboard.read()` first and `readText()` when that is missing or refused. Resolves with
 * no requests for an empty clipboard; throws `ClipboardDeniedError` when it cannot be read.
 */
export async function readClipboardRequests(
  clipboard: ClipboardLike = typeof navigator === "undefined" ? {} : navigator.clipboard,
): Promise<{ requests: CaptureRequest[]; capped: boolean }> {
  if (clipboard.read) {
    try {
      return readDataTransfer(await transferFromItems(await clipboard.read()));
    } catch {
      // Refused or unsupported: try the text-only API before giving up.
    }
  }
  if (clipboard.readText) {
    try {
      const text = await clipboard.readText();
      return readDataTransfer({ getData: (format) => (format === "text/plain" ? text : "") });
    } catch {
      // Falls through to the denied error.
    }
  }
  throw new ClipboardDeniedError();
}
