/** An embeddable video: `src` is built here from a parsed id, never copied from the input. */
export type VideoEmbed = {
  provider: "youtube" | "vimeo";
  id: string;
  src: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{6,32}$/;

function parseHttpUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  return url.protocol === "https:" || url.protocol === "http:" ? url : null;
}

/** `youtube.com` and its subdomains, but never a host that merely ends with the same letters. */
function isHostOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return segments[0] ?? null;

  const isYoutube =
    isHostOrSubdomain(host, "youtube.com") || isHostOrSubdomain(host, "youtube-nocookie.com");
  if (!isYoutube) return null;

  if (segments[0] === "watch") return url.searchParams.get("v");
  if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") {
    return segments[1] ?? null;
  }
  return null;
}

function vimeoParts(url: URL): { id: string; hash: string | null } | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "player.vimeo.com") {
    return segments[0] === "video" && segments[1]
      ? { id: segments[1], hash: url.searchParams.get("h") }
      : null;
  }
  if (!isHostOrSubdomain(host, "vimeo.com")) return null;

  // vimeo.com/123, vimeo.com/123/<hash> (unlisted), vimeo.com/channels/<name>/123
  const idIndex = segments.findIndex((segment) => VIMEO_ID.test(segment));
  if (idIndex === -1) return null;
  const id = segments[idIndex] ?? "";
  const next = segments[idIndex + 1];
  return { id, hash: next ?? url.searchParams.get("h") };
}

/**
 * Parses a YouTube or Vimeo link into a privacy-friendly embed URL, or null for anything else.
 * Only `youtube-nocookie.com` and `player.vimeo.com` URLs are ever produced, and only from an id
 * that passed a strict pattern, so an arbitrary page can never end up in an iframe.
 */
export function parseVideoEmbed(input: string | null | undefined): VideoEmbed | null {
  if (!input) return null;
  const url = parseHttpUrl(input);
  if (!url) return null;

  const youtube = youtubeId(url);
  if (youtube !== null) {
    if (!YOUTUBE_ID.test(youtube)) return null;
    return {
      provider: "youtube",
      id: youtube,
      src: `https://www.youtube-nocookie.com/embed/${youtube}`,
    };
  }

  const vimeo = vimeoParts(url);
  if (vimeo && VIMEO_ID.test(vimeo.id)) {
    const hash = vimeo.hash && VIMEO_HASH.test(vimeo.hash) ? `?h=${vimeo.hash}` : "";
    return {
      provider: "vimeo",
      id: vimeo.id,
      src: `https://player.vimeo.com/video/${vimeo.id}${hash}`,
    };
  }
  return null;
}

/** The normalized href of an http(s) URL, or null (`javascript:` and friends never become links). */
export function safeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  return parseHttpUrl(input)?.href ?? null;
}
