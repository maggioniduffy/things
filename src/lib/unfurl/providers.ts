import { z } from "zod";
import { absoluteHttpUrl, cleanText, DESCRIPTION_MAX, SHORT_MAX, TITLE_MAX } from "./parse";
import type { UnfurlProvider, UnfurlResult } from "./types";

export type ProviderMatch = { provider: UnfurlProvider; oembedUrl: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com"]);

/** Returns the provider (and its oEmbed endpoint for this URL) when `url` points at one video. */
export function matchProvider(url: string): ProviderMatch | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const encoded = encodeURIComponent(parsed.href);

  const youtube = { provider: "youtube" as const };
  const youtubeOembed = `https://www.youtube.com/oembed?url=${encoded}&format=json`;
  if (YOUTUBE_HOSTS.has(host)) {
    const isWatch = parsed.pathname === "/watch" && !!parsed.searchParams.get("v");
    const isShort = /^\/shorts\/[\w-]+\/?$/.test(parsed.pathname);
    return isWatch || isShort ? { ...youtube, oembedUrl: youtubeOembed } : null;
  }
  if (host === "youtu.be") {
    return /^\/[\w-]+\/?$/.test(parsed.pathname) ? { ...youtube, oembedUrl: youtubeOembed } : null;
  }

  // vimeo.com/<digits>, optionally with the unlisted-video hash: vimeo.com/<digits>/<hash>
  if (host === "vimeo.com" && /^\/\d+(\/[a-z0-9]+)?\/?$/i.test(parsed.pathname)) {
    return {
      provider: "vimeo",
      oembedUrl: `https://vimeo.com/api/oembed.json?url=${encoded}`,
    };
  }
  return null;
}

// Every field is optional and a wrongly-typed one is ignored instead of failing the whole parse.
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const oEmbedSchema = z.object({
  title: lenient(z.string()),
  author_name: lenient(z.string()),
  provider_name: lenient(z.string()),
  thumbnail_url: lenient(z.string()),
  description: lenient(z.string()),
  duration: lenient(z.number()),
});

export type OEmbedFields = Pick<
  UnfurlResult,
  "title" | "description" | "siteName" | "imageUrl" | "metadata"
>;

/** Maps an oEmbed JSON document to unfurl fields. Missing or malformed fields become null. */
export function parseOEmbed(provider: UnfurlProvider, json: unknown): OEmbedFields {
  const parsed = oEmbedSchema.safeParse(json);
  const data = parsed.success ? parsed.data : {};

  const author = cleanText(data.author_name, SHORT_MAX);
  const duration = data.duration;
  const hasDuration = typeof duration === "number" && Number.isFinite(duration) && duration > 0;

  return {
    title: cleanText(data.title, TITLE_MAX),
    description: cleanText(data.description, DESCRIPTION_MAX),
    siteName:
      cleanText(data.provider_name, SHORT_MAX) ?? (provider === "youtube" ? "YouTube" : "Vimeo"),
    imageUrl: absoluteHttpUrl(data.thumbnail_url),
    metadata: {
      ...(author ? { author } : {}),
      ...(hasDuration ? { durationSeconds: Math.round(duration) } : {}),
    },
  };
}
