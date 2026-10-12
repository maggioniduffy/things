// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedUrlError, fetchSafe, UnreachableError, type SafeFetchResult } from "./fetch-safe";
import { unfurl } from "./unfurl";

// The network layer has its own tests; here fetchSafe is scripted per URL.
vi.mock("./fetch-safe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fetch-safe")>()),
  fetchSafe: vi.fn(),
}));

const fetchMock = vi.mocked(fetchSafe);

function page(overrides: Partial<SafeFetchResult> & { finalUrl: string }): SafeFetchResult {
  return { status: 200, contentType: "text/html; charset=utf-8", body: "", ...overrides };
}

function respond(routes: Record<string, SafeFetchResult | Error>) {
  fetchMock.mockImplementation(async (url) => {
    const route = routes[url];
    if (!route) throw new UnreachableError(`no route for ${url}`);
    if (route instanceof Error) throw route;
    return route;
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("unfurl: web pages", () => {
  it("parses the head of an HTML page after redirects", async () => {
    respond({
      "https://short.test/a": page({
        finalUrl: "https://blog.test/post",
        body: '<head><title>Post</title><meta property="og:type" content="article"><meta property="og:image" content="/c.png"></head>',
      }),
    });
    expect(await unfurl("https://short.test/a")).toEqual({
      url: "https://short.test/a",
      finalUrl: "https://blog.test/post",
      canonicalUrl: null,
      title: "Post",
      description: null,
      siteName: null,
      imageUrl: "https://blog.test/c.png",
      faviconUrl: "https://blog.test/favicon.ico",
      isArticle: true,
      provider: null,
      metadata: {},
    });
  });

  it("returns a mostly empty result for non-HTML content", async () => {
    respond({
      "https://files.test/a.pdf": page({
        finalUrl: "https://files.test/a.pdf",
        contentType: "application/pdf",
      }),
    });
    expect(await unfurl("https://files.test/a.pdf")).toEqual({
      url: "https://files.test/a.pdf",
      finalUrl: "https://files.test/a.pdf",
      canonicalUrl: null,
      title: null,
      description: null,
      siteName: null,
      imageUrl: null,
      faviconUrl: "https://files.test/favicon.ico",
      isArticle: false,
      provider: null,
      metadata: {},
    });
  });

  it("lets blocked and unreachable errors through", async () => {
    respond({
      "https://a.test/": new BlockedUrlError(),
      "https://b.test/": new UnreachableError(),
    });
    await expect(unfurl("https://a.test/")).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(unfurl("https://b.test/")).rejects.toBeInstanceOf(UnreachableError);
  });
});

describe("unfurl: providers", () => {
  const videoUrl = "https://youtu.be/dQw4w9WgXcQ";
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

  it("uses oEmbed and skips the page", async () => {
    respond({
      [oembedUrl]: page({
        finalUrl: oembedUrl,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Never Gonna Give You Up",
          author_name: "Rick Astley",
          provider_name: "YouTube",
          thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg",
        }),
      }),
    });
    const result = await unfurl(videoUrl);
    expect(result).toMatchObject({
      url: videoUrl,
      finalUrl: videoUrl,
      title: "Never Gonna Give You Up",
      siteName: "YouTube",
      imageUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
      faviconUrl: "https://youtu.be/favicon.ico",
      provider: "youtube",
      isArticle: false,
      metadata: { author: "Rick Astley" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ accept: "application/json" });
  });

  it("falls back to the page when oEmbed fails", async () => {
    respond({
      [oembedUrl]: new UnreachableError(),
      [videoUrl]: page({
        finalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        body: "<head><title>From the page</title></head>",
      }),
    });
    const result = await unfurl(videoUrl);
    expect(result.title).toBe("From the page");
    expect(result.provider).toBe("youtube");
  });

  it("falls back to the page when oEmbed is not JSON or has no title", async () => {
    respond({
      [oembedUrl]: page({ finalUrl: oembedUrl, contentType: "application/json", body: "<html>" }),
      [videoUrl]: page({ finalUrl: videoUrl, body: "<head><title>Page</title></head>" }),
    });
    expect((await unfurl(videoUrl)).title).toBe("Page");

    respond({
      [oembedUrl]: page({ finalUrl: oembedUrl, contentType: "application/json", body: "{}" }),
      [videoUrl]: page({ finalUrl: videoUrl, body: "<head><title>Page 2</title></head>" }),
    });
    expect((await unfurl(videoUrl)).title).toBe("Page 2");
  });

  it("maps a Vimeo oEmbed with a duration", async () => {
    const url = "https://vimeo.com/76979871";
    const endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    respond({
      [endpoint]: page({
        finalUrl: endpoint,
        contentType: "application/json",
        body: JSON.stringify({ title: "A film", provider_name: "Vimeo", duration: 90 }),
      }),
    });
    expect(await unfurl(url)).toMatchObject({
      provider: "vimeo",
      title: "A film",
      metadata: { durationSeconds: 90 },
    });
  });
});
