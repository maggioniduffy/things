import type { ItemKind } from "@/types/supabase";

/** What the user captured. */
export type CaptureInput =
  | { type: "file"; mimeType: string; fileName: string }
  | { type: "url"; url: string }
  | { type: "text"; text: string };

const MAX_URL_LENGTH = 2048;

const EXTENSION_GROUPS: ReadonlyArray<readonly [ItemKind, readonly string[]]> = [
  [
    "image",
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "avif",
      "svg",
      "bmp",
      "heic",
      "heif",
      "tif",
      "tiff",
      "ico",
    ],
  ],
  ["pdf", ["pdf"]],
  ["audio", ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"]],
  ["video", ["mp4", "m4v", "webm", "mov", "mkv", "avi"]],
  [
    "document",
    [
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "odt",
      "ods",
      "odp",
      "rtf",
      "txt",
      "md",
      "markdown",
      "csv",
    ],
  ],
];

const EXTENSION_KINDS: ReadonlyMap<string, ItemKind> = new Map(
  EXTENSION_GROUPS.flatMap(([kind, extensions]) => extensions.map((ext) => [ext, kind] as const)),
);

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com", "vimeo.com", "loom.com"];
const CODE_HOSTS = ["github.com", "gitlab.com", "codepen.io", "codesandbox.io"];

/** Lower-case extension of the last dot-separated segment of a file name or path segment. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function hostMatches(hostname: string, domains: readonly string[]): boolean {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function kindFromMime(mime: string): ItemKind {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (
    mime.startsWith("text/") ||
    mime === "application/msword" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/rtf" ||
    mime.startsWith("application/vnd.openxmlformats-officedocument.") ||
    mime.startsWith("application/vnd.oasis.opendocument.")
  ) {
    return "document";
  }
  return "other";
}

/**
 * Kind of a file from its MIME type, falling back to the file extension when the MIME type
 * is empty or `application/octet-stream` (browsers report "" for .md and many others).
 */
export function detectFileKind(mimeType: string, fileName: string): ItemKind {
  const mime = mimeType
    .replace(/;[\s\S]*$/, "")
    .trim()
    .toLowerCase();
  if (mime === "" || mime === "application/octet-stream") {
    return EXTENSION_KINDS.get(extensionOf(fileName)) ?? "other";
  }
  return kindFromMime(mime);
}

/** Kind of a URL before unfurl (host + path rules). Unparseable input is a plain link. */
export function detectUrlKind(url: string): ItemKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "link";
  }
  if (hostMatches(parsed.hostname, VIDEO_HOSTS)) return "video";
  if (hostMatches(parsed.hostname, CODE_HOSTS)) return "code";

  const lastSegment = parsed.pathname.slice(parsed.pathname.lastIndexOf("/") + 1);
  const byExtension = EXTENSION_KINDS.get(extensionOf(lastSegment));
  // Only media/PDF extensions classify a URL; a .txt or .docx URL stays a link.
  if (byExtension && byExtension !== "document") return byExtension;
  return "link";
}

/** After unfurl: a `link` becomes `article` when the page says so; every other kind is unchanged. */
export function refineKindAfterUnfurl(kind: ItemKind, page: { isArticle: boolean }): ItemKind {
  return kind === "link" && page.isArticle ? "article" : kind;
}

/**
 * Parses pasted/typed text as a saveable URL, or returns null (then it's a note).
 * Accepts trimmed text with no internal whitespace that is an absolute http(s) URL or a
 * bare `www.` host (assumed https). Rejects other schemes, text over 2048 chars and hosts
 * without a dot. Returns the normalized `URL.href`.
 */
export function parseUrlInput(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) return null;

  let candidate: string;
  if (/^https?:\/\//i.test(trimmed)) candidate = trimmed;
  else if (/^www\./i.test(trimmed)) candidate = `https://${trimmed}`;
  else return null;

  try {
    const parsed = new URL(candidate);
    // At least two non-empty labels ("www." and "a..b" are not hosts).
    if (!/^[^.]+(\.[^.]+)+$/.test(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Display domain: lower-case hostname without a leading `www.`; null for unparseable input. */
export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function detectKind(input: CaptureInput): ItemKind {
  switch (input.type) {
    case "file":
      return detectFileKind(input.mimeType, input.fileName);
    case "url":
      return detectUrlKind(input.url);
    case "text": {
      const url = parseUrlInput(input.text);
      return url ? detectUrlKind(url) : "note";
    }
  }
}
