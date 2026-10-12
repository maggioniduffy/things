// @vitest-environment node
import { describe, expect, it } from "vitest";
import { matchProvider, parseOEmbed } from "./providers";

describe("matchProvider", () => {
  const youtube = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/abcDEF_-123",
    "http://youtube.com/shorts/abcDEF_-123",
  ];
  const vimeo = [
    "https://vimeo.com/76979871",
    "https://www.vimeo.com/76979871",
    "https://vimeo.com/76979871/abc123def4",
  ];
  const none = [
    "https://www.youtube.com/",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/playlist?list=PL1",
    "https://youtu.be/",
    "https://notyoutube.com/watch?v=abc",
    "https://youtube.com.evil.test/watch?v=abc",
    "https://vimeo.com/",
    "https://vimeo.com/channels/staffpicks",
    "https://vimeo.com/channels/staffpicks/76979871",
    "https://example.com/watch?v=abc",
    "ftp://youtube.com/watch?v=abc",
    "not a url",
  ];

  it.each(youtube)("matches %s as youtube", (url) => {
    const match = matchProvider(url);
    expect(match?.provider).toBe("youtube");
    expect(match?.oembedUrl).toBe(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(new URL(url).href)}&format=json`,
    );
  });

  it.each(vimeo)("matches %s as vimeo", (url) => {
    const match = matchProvider(url);
    expect(match?.provider).toBe("vimeo");
    expect(match?.oembedUrl).toBe(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(new URL(url).href)}`,
    );
  });

  it.each(none)("does not match %s", (url) => {
    expect(matchProvider(url)).toBeNull();
  });
});

describe("parseOEmbed", () => {
  it("maps a YouTube response (no duration)", () => {
    expect(
      parseOEmbed("youtube", {
        title: "Never Gonna Give You Up",
        author_name: "Rick Astley",
        provider_name: "YouTube",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        type: "video",
      }),
    ).toEqual({
      title: "Never Gonna Give You Up",
      description: null,
      siteName: "YouTube",
      imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      metadata: { author: "Rick Astley" },
    });
  });

  it("maps a Vimeo response with a duration", () => {
    expect(
      parseOEmbed("vimeo", {
        title: "A film",
        author_name: "A director",
        provider_name: "Vimeo",
        thumbnail_url: "https://i.vimeocdn.com/video/1_640.jpg",
        description: "About the film.",
        duration: 123.4,
      }),
    ).toEqual({
      title: "A film",
      description: "About the film.",
      siteName: "Vimeo",
      imageUrl: "https://i.vimeocdn.com/video/1_640.jpg",
      metadata: { author: "A director", durationSeconds: 123 },
    });
  });

  it("tolerates missing, wrongly typed and unsafe fields", () => {
    expect(parseOEmbed("vimeo", {})).toEqual({
      title: null,
      description: null,
      siteName: "Vimeo",
      imageUrl: null,
      metadata: {},
    });
    expect(
      parseOEmbed("youtube", {
        title: 42,
        duration: "10",
        thumbnail_url: "javascript:alert(1)",
        author_name: "  ",
      }),
    ).toEqual({
      title: null,
      description: null,
      siteName: "YouTube",
      imageUrl: null,
      metadata: {},
    });
    expect(parseOEmbed("youtube", null).title).toBeNull();
    expect(parseOEmbed("youtube", "nope").metadata).toEqual({});
  });
});
