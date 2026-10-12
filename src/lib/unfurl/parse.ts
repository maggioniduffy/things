import { parseHTML } from "linkedom";
import type { UnfurlResult } from "./types";

export const TITLE_MAX = 300;
export const DESCRIPTION_MAX = 1000;
export const SHORT_MAX = 200;
// Pages without a `</head>` (or truncated mid-head) are parsed up to this many characters.
const HEADLESS_SLICE = 200_000;

export type ParsedHead = Omit<UnfurlResult, "url" | "finalUrl" | "provider">;

/** Collapses whitespace, trims and caps the length; empty text becomes null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

/** Resolves `value` against `base` (when given); anything that is not http(s) (javascript:, data:, ...) is dropped. */
export function absoluteHttpUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Attribute lookup that ignores the name's case (linkedom keeps `PROPERTY=` as written). */
function attr(element: Element, name: string): string | null {
  const direct = element.getAttribute(name);
  if (direct !== null) return direct;
  for (const candidate of Array.from(element.attributes)) {
    if (candidate.name.toLowerCase() === name) return candidate.value;
  }
  return null;
}

/** Only the part of the document that can hold metadata. */
function sliceHead(html: string): string {
  const end = html.search(/<\/head\s*>|<body[\s>]/i);
  return end >= 0 ? html.slice(0, end) : html.slice(0, HEADLESS_SLICE);
}

/**
 * Extracts link metadata from the `<head>` of an HTML document.
 * `baseUrl` (the final URL after redirects) resolves relative URLs and gives the favicon fallback.
 */
export function parseHead(html: string, baseUrl: string): ParsedHead {
  // Close the head ourselves so linkedom always sees a complete document.
  const { document } = parseHTML(`${sliceHead(html)}</head><body></body></html>`);

  // First occurrence wins, keyed by lowercased property/name.
  const meta = new Map<string, string>();
  for (const element of document.querySelectorAll("meta")) {
    const key = (attr(element, "property") ?? attr(element, "name") ?? "").trim().toLowerCase();
    const content = attr(element, "content");
    if (key && content !== null && !meta.has(key)) meta.set(key, content);
  }
  const first = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta.get(key);
      if (value !== undefined && value.trim()) return value;
    }
    return undefined;
  };

  // `rel` is a space-separated token list; collect hrefs of links that carry a given token.
  const linkHrefs = (token: string) =>
    [...document.querySelectorAll("link")]
      .filter((link) => (attr(link, "rel") ?? "").toLowerCase().split(/\s+/).includes(token))
      .map((link) => attr(link, "href"));
  const firstHttp = (hrefs: (string | null)[]) => {
    for (const href of hrefs) {
      const url = absoluteHttpUrl(href, baseUrl);
      if (url) return url;
    }
    return null;
  };

  let origin: string | null = null;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    // baseUrl is always a validated URL in practice.
  }

  const publishedTime = cleanText(meta.get("article:published_time"), SHORT_MAX);
  const author = cleanText(first("author"), SHORT_MAX);

  return {
    canonicalUrl: firstHttp(linkHrefs("canonical")),
    title: cleanText(
      first("og:title", "twitter:title") ?? document.querySelector("title")?.textContent,
      TITLE_MAX,
    ),
    description: cleanText(
      first("og:description", "twitter:description", "description"),
      DESCRIPTION_MAX,
    ),
    siteName: cleanText(meta.get("og:site_name"), SHORT_MAX),
    // An unusable og:image (javascript:, data:) falls through to the next candidate.
    imageUrl: firstHttp(
      ["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"].map(
        (key) => meta.get(key) ?? null,
      ),
    ),
    faviconUrl:
      firstHttp(linkHrefs("icon")) ??
      firstHttp([...linkHrefs("apple-touch-icon"), ...linkHrefs("apple-touch-icon-precomposed")]) ??
      (origin ? `${origin}/favicon.ico` : null),
    isArticle: first("og:type")?.trim().toLowerCase() === "article" || publishedTime !== null,
    metadata: {
      ...(author ? { author } : {}),
      ...(publishedTime ? { publishedTime } : {}),
    },
  };
}
