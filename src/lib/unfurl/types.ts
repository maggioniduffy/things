// Shared between the /api/unfurl route and the browser: no server-only imports here.

export type UnfurlProvider = "youtube" | "vimeo";

export type UnfurlResult = {
  /** The requested URL. */
  url: string;
  /** After redirects. */
  finalUrl: string;
  /** `<link rel=canonical>`, absolute http(s) only. */
  canonicalUrl: string | null;
  /** og:title, then twitter:title, then `<title>`; trimmed, at most 300 characters. */
  title: string | null;
  /** og:description, then twitter:description, then meta description; at most 1000 characters. */
  description: string | null;
  /** og:site_name (or oEmbed provider_name). */
  siteName: string | null;
  /** og:image(:secure_url), then twitter:image; absolute http(s) only. */
  imageUrl: string | null;
  /** First `<link rel~=icon>` (apple-touch-icon as a last resort), else `${origin}/favicon.ico`. */
  faviconUrl: string | null;
  /** og:type is article, or an article:published_time meta is present. */
  isArticle: boolean;
  provider: UnfurlProvider | null;
  metadata: { durationSeconds?: number; author?: string; publishedTime?: string };
};

export type UnfurlErrorCode =
  "invalid_url" | "unauthorized" | "rate_limited" | "blocked" | "unreachable";

export type UnfurlErrorBody = { error: UnfurlErrorCode };
