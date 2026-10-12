import { toast } from "sonner";
import { parseUrlInput } from "@/lib/items/detect-kind";

/** One thing to save, as read from a paste, a drop or the quick add field. */
export type CaptureRequest =
  { type: "file"; file: File } | { type: "url"; url: string } | { type: "note"; text: string };

/** Most things saved by one gesture; the rest are dropped with a toast. */
export const MAX_CAPTURES = 20;
export const CAPPED_COPY = `Saved the first ${MAX_CAPTURES} items.`;

/** The part of `useCapture` that saving requests needs. */
export type Capture = {
  captureLink(url: string): Promise<void>;
  captureNote(text: string): Promise<void>;
  captureFile(file: File): Promise<void>;
};

/** The slice of `DataTransfer` we read, so tests can pass a plain object. */
export type DataTransferLike = {
  files?: ArrayLike<File> | null;
  getData(format: string): string;
};

/** Just the files of a `DataTransfer` or an `<input type="file">`. */
export type FileSource = { files?: ArrayLike<File> | null };

/**
 * A directory (or an empty placeholder) shows up in `files` as a zero-byte entry with no type.
 * Real empty files have an extension, so they are kept.
 */
function isSaveableFile(file: File): boolean {
  if (file.size > 0 || file.type !== "") return true;
  return /\.[^./\\]+$/.test(file.name);
}

function readData(dataTransfer: DataTransferLike, format: string): string {
  try {
    return dataTransfer.getData(format);
  } catch {
    return "";
  }
}

/** Absolute URLs in a `text/uri-list` body; comment lines and anything that is not a URL are skipped. */
function urlsFromUriList(list: string): string[] {
  return list
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .flatMap((line) => parseUrlInput(line) ?? []);
}

/**
 * Plain text as requests: a block of up to 20 lines that are all URLs becomes one link each;
 * anything else is a single note holding the whole text. Empty text yields nothing.
 */
export function requestsFromText(text: string): CaptureRequest[] {
  if (text.trim() === "") return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length <= MAX_CAPTURES) {
    const urls = lines.map((line) => parseUrlInput(line));
    if (urls.every((url): url is string => url !== null)) {
      return urls.map((url) => ({ type: "url", url }));
    }
  }
  return [{ type: "note", text }];
}

/** Every file in the transfer as a file request, skipping directories. */
export function fileRequests(dataTransfer: FileSource): CaptureRequest[] {
  return Array.from(dataTransfer.files ?? [])
    .filter(isSaveableFile)
    .map((file) => ({ type: "file", file }));
}

/** All requests in the transfer, before the per-gesture cap. */
function allRequests(dataTransfer: DataTransferLike): CaptureRequest[] {
  const files = fileRequests(dataTransfer);
  if (files.length > 0) return files;

  const urls = urlsFromUriList(readData(dataTransfer, "text/uri-list"));
  if (urls.length > 0) return urls.map((url) => ({ type: "url", url }));

  return requestsFromText(readData(dataTransfer, "text/plain"));
}

export function capRequests(requests: CaptureRequest[]): {
  requests: CaptureRequest[];
  capped: boolean;
} {
  return requests.length > MAX_CAPTURES
    ? { requests: requests.slice(0, MAX_CAPTURES), capped: true }
    : { requests, capped: false };
}

/**
 * What a paste or a drop holds, in priority order: files, then `text/uri-list`, then
 * `text/plain` (see `requestsFromText`). At most 20 requests.
 */
export function itemsFromDataTransfer(dataTransfer: DataTransferLike): CaptureRequest[] {
  return capRequests(allRequests(dataTransfer)).requests;
}

/** `itemsFromDataTransfer`, also telling whether the cap cut anything off. */
export function readDataTransfer(dataTransfer: DataTransferLike) {
  return capRequests(allRequests(dataTransfer));
}

/**
 * Starts saving every request. Each new card goes before the previous one, so requests are
 * started last to first: the first file you dropped ends up first on the board.
 * Captures report their own failures; this never rejects.
 */
export function saveRequests(
  capture: Capture,
  { requests, capped }: { requests: CaptureRequest[]; capped: boolean },
): void {
  if (capped) toast(CAPPED_COPY);
  for (const request of [...requests].reverse()) {
    switch (request.type) {
      case "file":
        void capture.captureFile(request.file);
        break;
      case "url":
        void capture.captureLink(request.url);
        break;
      case "note":
        void capture.captureNote(request.text);
        break;
    }
  }
}

/** Whether a drag carries something we can save (files, a link or text), as opposed to e.g. a UI drag. */
export function isExternalDrag(types: ArrayLike<string> | null | undefined): boolean {
  const list = Array.from(types ?? []);
  return list.some((type) => type === "Files" || type === "text/uri-list" || type === "text/plain");
}
