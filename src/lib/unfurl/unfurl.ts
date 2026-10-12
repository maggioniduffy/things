import { fetchSafe, type SafeFetchOptions } from "./fetch-safe";
import { parseHead } from "./parse";
import { matchProvider, parseOEmbed, type ProviderMatch } from "./providers";
import type { UnfurlResult } from "./types";

const HTML_TYPE = /html|xhtml/i;

function faviconFor(pageUrl: string): string | null {
  try {
    return `${new URL(pageUrl).origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/** oEmbed JSON for a matched provider, or null when anything about it fails (caller falls back). */
async function fetchOEmbed(
  match: ProviderMatch,
  options: SafeFetchOptions,
): Promise<ReturnType<typeof parseOEmbed> | null> {
  try {
    const response = await fetchSafe(match.oembedUrl, { ...options, accept: "application/json" });
    const fields = parseOEmbed(match.provider, JSON.parse(response.body));
    // An oEmbed document without a title is not worth showing; use the page instead.
    return fields.title ? fields : null;
  } catch {
    return null;
  }
}

/**
 * Fetches `url` through the SSRF guard and returns its metadata.
 * YouTube and Vimeo use oEmbed first and fall back to parsing the page.
 * Throws BlockedUrlError or UnreachableError (from `fetchSafe`).
 */
export async function unfurl(url: string, options: SafeFetchOptions = {}): Promise<UnfurlResult> {
  const match = matchProvider(url);
  const provider = match?.provider ?? null;

  if (match) {
    const oembed = await fetchOEmbed(match, options);
    if (oembed) {
      return {
        url,
        finalUrl: url,
        canonicalUrl: null,
        ...oembed,
        faviconUrl: faviconFor(url),
        isArticle: false,
        provider,
      };
    }
  }

  const page = await fetchSafe(url, options);

  // A PDF, image or other non-HTML 2xx still succeeds; the client keeps its URL-based kind.
  if (page.contentType !== null && !HTML_TYPE.test(page.contentType)) {
    return {
      url,
      finalUrl: page.finalUrl,
      canonicalUrl: null,
      title: null,
      description: null,
      siteName: null,
      imageUrl: null,
      faviconUrl: faviconFor(page.finalUrl),
      isArticle: false,
      provider,
      metadata: {},
    };
  }

  return { url, finalUrl: page.finalUrl, ...parseHead(page.body, page.finalUrl), provider };
}
