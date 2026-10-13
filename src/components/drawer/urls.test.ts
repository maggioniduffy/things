import { describe, expect, it } from "vitest";
import { parseVideoEmbed, safeHttpUrl } from "./urls";

const ID = "dQw4w9WgXcQ";

describe("parseVideoEmbed", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=10s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `http://youtu.be/${ID}`,
  ])("embeds %s through youtube-nocookie.com", (input) => {
    expect(parseVideoEmbed(input)).toEqual({
      provider: "youtube",
      id: ID,
      src: `https://www.youtube-nocookie.com/embed/${ID}`,
    });
  });

  it.each([
    ["https://vimeo.com/76979871", "76979871", "https://player.vimeo.com/video/76979871"],
    ["https://www.vimeo.com/76979871", "76979871", "https://player.vimeo.com/video/76979871"],
    [
      "https://vimeo.com/channels/staffpicks/76979871",
      "76979871",
      "https://player.vimeo.com/video/76979871",
    ],
    [
      "https://player.vimeo.com/video/76979871",
      "76979871",
      "https://player.vimeo.com/video/76979871",
    ],
    [
      "https://vimeo.com/76979871/abc123def4",
      "76979871",
      "https://player.vimeo.com/video/76979871?h=abc123def4",
    ],
    [
      "https://player.vimeo.com/video/76979871?h=abc123def4",
      "76979871",
      "https://player.vimeo.com/video/76979871?h=abc123def4",
    ],
  ])("embeds %s through player.vimeo.com", (input, id, src) => {
    expect(parseVideoEmbed(input)).toEqual({ provider: "vimeo", id, src });
  });

  it.each([
    // Lookalike and unrelated hosts
    `https://evilyoutube.com/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://evil.example/youtube.com/watch?v=${ID}`,
    `https://notyoutu.be/${ID}`,
    "https://evilvimeo.com/76979871",
    "https://vimeo.com.evil.example/76979871",
    "https://player.vimeo.com.evil.example/video/76979871",
    "https://example.com/video.mp4",
    // Right host, wrong shape
    "https://www.youtube.com/",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/playlist?list=PL123",
    "https://vimeo.com/",
    "https://vimeo.com/channels/staffpicks",
    // Ids that fail the strict pattern (no path or script smuggling)
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch?v=${ID}extra`,
    'https://www.youtube.com/watch?v=abc"onload=alert(1)',
    "https://www.youtube.com/embed/..%2F..%2Fevil",
    // Not http(s)
    `javascript:alert(1)//youtube.com/watch?v=${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    "data:text/html,<script>alert(1)</script>",
    "not a url",
    "",
  ])("rejects %s", (input) => {
    expect(parseVideoEmbed(input)).toBeNull();
  });

  it("rejects missing input and drops a malformed Vimeo hash", () => {
    expect(parseVideoEmbed(null)).toBeNull();
    expect(parseVideoEmbed(undefined)).toBeNull();
    expect(parseVideoEmbed("https://vimeo.com/76979871/not-a-hash!")?.src).toBe(
      "https://player.vimeo.com/video/76979871",
    );
  });
});

describe("safeHttpUrl", () => {
  it("returns http and https URLs and nothing else", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("mailto:a@b.c")).toBeNull();
    expect(safeHttpUrl("nope")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
