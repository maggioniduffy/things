// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseHead } from "./parse";

function fixture(name: string) {
  return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8");
}

describe("parseHead", () => {
  it("reads an article page: og tags win, relative URLs resolve against the base", () => {
    const result = parseHead(fixture("article.html"), "https://blog.example.com/posts/x?utm=1");
    expect(result).toEqual({
      canonicalUrl: "https://blog.example.com/posts/how-we-shipped-it",
      title: "How we shipped it",
      description: "A long read about shipping.",
      siteName: "Example Blog",
      imageUrl: "https://blog.example.com/img/cover.jpg",
      faviconUrl: "https://blog.example.com/static/icon.png",
      isArticle: true,
      metadata: { author: "Ada Lovelace", publishedTime: "2025-03-04T10:00:00Z" },
    });
  });

  it("falls back to <title>, the meta description and /favicon.ico on a plain page", () => {
    const result = parseHead(fixture("plain.html"), "https://plain.example.com/a/b");
    expect(result).toEqual({
      canonicalUrl: null,
      title: "A plain page",
      description: "Just a title and a description.",
      siteName: null,
      imageUrl: null,
      faviconUrl: "https://plain.example.com/favicon.ico",
      isArticle: false,
      metadata: {},
    });
  });

  it("decodes entities, handles an uppercase <HEAD> and ignores tags in the body", () => {
    const result = parseHead(fixture("entities-uppercase.html"), "https://example.com/");
    expect(result.title).toBe('Tom & Jerry\'s "big" day — café');
    expect(result.description).toBe("Fish & chips for two");
    expect(result.faviconUrl).toBe("https://cdn.example.org/fav.ico");
  });

  it("drops javascript: and data: URLs and falls through to the next valid candidate", () => {
    const result = parseHead(fixture("unsafe-urls.html"), "https://example.com/dir/page");
    expect(result.imageUrl).toBe("https://img.example.com/ok.png");
    expect(result.canonicalUrl).toBeNull();
    expect(result.faviconUrl).toBe("https://example.com/dir/icons/small.png");
  });

  it("returns a null image when the only candidate is javascript:", () => {
    const html = '<head><meta property="og:image" content="javascript:alert(1)"></head>';
    expect(parseHead(html, "https://example.com/").imageUrl).toBeNull();
  });

  it("uses apple-touch-icon only when there is no other icon", () => {
    const html = '<head><link rel="apple-touch-icon" href="/a.png"></head>';
    expect(parseHead(html, "https://example.com/x").faviconUrl).toBe("https://example.com/a.png");
  });

  it("treats an article:published_time meta as an article without og:type", () => {
    const html = '<head><meta property="article:published_time" content="2024-01-01"></head>';
    expect(parseHead(html, "https://example.com/").isArticle).toBe(true);
  });

  it("caps long titles and descriptions", () => {
    const html = `<head><title>${"t".repeat(500)}</title><meta name="description" content="${"d".repeat(2000)}"></head>`;
    const result = parseHead(html, "https://example.com/");
    expect(result.title).toHaveLength(300);
    expect(result.description).toHaveLength(1000);
  });

  it("copes with empty and head-less input", () => {
    expect(parseHead("", "https://example.com/").title).toBeNull();
    expect(parseHead("<p>no head</p>", "https://example.com/").faviconUrl).toBe(
      "https://example.com/favicon.ico",
    );
  });
});
