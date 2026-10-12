import { describe, expect, it } from "vitest";
import type { ItemKind } from "@/types/supabase";
import {
  detectFileKind,
  detectKind,
  detectUrlKind,
  domainOf,
  parseUrlInput,
  refineKindAfterUnfurl,
} from "./detect-kind";

describe("detectFileKind", () => {
  it.each<[string, string, ItemKind]>([
    ["image/png", "a.png", "image"],
    ["image/svg+xml", "a.svg", "image"],
    ["application/pdf", "a.pdf", "pdf"],
    ["audio/mpeg", "a.mp3", "audio"],
    ["video/mp4", "a.mp4", "video"],
    ["application/msword", "a.doc", "document"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "a.docx",
      "document",
    ],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx", "document"],
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "a.pptx",
      "document",
    ],
    ["application/vnd.ms-excel", "a.xls", "document"],
    ["application/vnd.ms-powerpoint", "a.ppt", "document"],
    ["application/vnd.oasis.opendocument.text", "a.odt", "document"],
    ["application/rtf", "a.rtf", "document"],
    ["text/plain", "a.txt", "document"],
    ["text/markdown", "notes.md", "document"],
    ["text/csv", "a.csv", "document"],
    ["text/plain; charset=utf-8", "a.txt", "document"],
    ["IMAGE/PNG", "a.png", "image"],
    ["  Application/PDF ; x=y", "a.pdf", "pdf"],
    ["application/zip", "a.zip", "other"],
    ["application/zip", "a.png", "other"],
    ["", "README.MD", "document"],
    ["", "photo.JPG", "image"],
    ["", "doc.pdf", "pdf"],
    ["", "song.flac", "audio"],
    ["", "clip.MOV", "video"],
    ["", "sheet.xlsx", "document"],
    ["application/octet-stream", "x.bin", "other"],
    ["application/octet-stream", "x.webp", "image"],
    ["", "noextension", "other"],
    ["", "constructor", "other"],
    ["", "archive.tar.gz", "other"],
  ])("%j + %j -> %s", (mime, name, expected) => {
    expect(detectFileKind(mime, name)).toBe(expected);
  });
});

describe("detectUrlKind", () => {
  it.each<[string, ItemKind]>([
    ["https://youtu.be/dQw4w9WgXcQ", "video"],
    ["https://www.youtube.com/watch?v=x&t=1", "video"],
    ["https://m.youtube.com/watch?v=x", "video"],
    ["https://music.youtube.com/watch?v=x", "video"],
    ["https://www.youtube-nocookie.com/embed/x", "video"],
    ["https://vimeo.com/123", "video"],
    ["https://player.vimeo.com/video/123", "video"],
    ["https://www.loom.com/share/abc", "video"],
    ["HTTPS://WWW.YouTube.com/watch", "video"],
    ["https://github.com/a/b", "code"],
    ["https://gist.github.com/a/b", "code"],
    ["https://gitlab.com/a/b", "code"],
    ["https://codepen.io/a/pen/b", "code"],
    ["https://codesandbox.io/s/x", "code"],
    ["https://github.com/a/b/raw/main/pic.png", "code"],
    ["https://example.com/file.PDF?dl=1", "pdf"],
    ["https://example.com/a.JPG#x", "image"],
    ["https://example.com/a.png", "image"],
    ["https://example.com/a.mp4", "video"],
    ["https://example.com/a.mp3", "audio"],
    ["https://example.com/dir.pdf/page", "link"],
    ["https://example.com/a.docx", "link"],
    ["https://example.com/a.txt", "link"],
    ["https://example.com/page?file=x.pdf", "link"],
    ["https://example.com/", "link"],
    ["https://example.com", "link"],
    ["https://notyoutube.com/watch", "link"],
    ["https://github.com.evil.io/", "link"],
    ["https://evilgithub.com/", "link"],
    ["not a url", "link"],
    ["", "link"],
  ])("%s -> %s", (url, expected) => {
    expect(detectUrlKind(url)).toBe(expected);
  });
});

describe("refineKindAfterUnfurl", () => {
  it.each<[ItemKind, boolean, ItemKind]>([
    ["link", true, "article"],
    ["link", false, "link"],
    ["video", true, "video"],
    ["code", true, "code"],
    ["pdf", true, "pdf"],
    ["article", true, "article"],
  ])("%s with isArticle=%s -> %s", (kind, isArticle, expected) => {
    expect(refineKindAfterUnfurl(kind, { isArticle })).toBe(expected);
  });
});

describe("parseUrlInput", () => {
  it.each<[string, string | null]>([
    ["https://example.com", "https://example.com/"],
    ["http://example.com/a?b=1#c", "http://example.com/a?b=1#c"],
    ["  https://example.com/x  ", "https://example.com/x"],
    ["\nhttps://example.com\n", "https://example.com/"],
    ["HTTPS://EXAMPLE.COM/Path", "https://example.com/Path"],
    ["www.example.com/path", "https://www.example.com/path"],
    ["WWW.Example.com", "https://www.example.com/"],
    ["https://1.2.3.4/x", "https://1.2.3.4/x"],
    ["javascript:alert(1)", null],
    ["data:text/html,hi", null],
    ["file:///etc/passwd", null],
    ["mailto:a@b.co", null],
    ["ftp://x.com", null],
    ["example", null],
    ["example.com", null],
    ["hello world https://x.com", null],
    ["https://x.com and more", null],
    ["https://localhost:3000", null],
    ["http://intranet/page", null],
    ["https://", null],
    ["https://exa mple.com", null],
    ["www.", null],
    ["https://a..b/", null],
    ["https://example.com./", null],
    ["", null],
    ["   ", null],
    [`https://example.com/${"a".repeat(2048)}`, null],
    [
      `https://example.com/${"a".repeat(2048 - "https://example.com/".length)}`,
      `https://example.com/${"a".repeat(2048 - "https://example.com/".length)}`,
    ],
  ])("%j -> %j", (text, expected) => {
    expect(parseUrlInput(text)).toBe(expected);
  });
});

describe("domainOf", () => {
  it.each<[string, string | null]>([
    ["https://www.example.com/a", "example.com"],
    ["https://Example.COM", "example.com"],
    ["https://m.example.com", "m.example.com"],
    ["https://wwwexample.com", "wwwexample.com"],
    ["nope", null],
    ["", null],
  ])("%s -> %s", (url, expected) => {
    expect(domainOf(url)).toBe(expected);
  });
});

describe("detectKind", () => {
  it.each<[Parameters<typeof detectKind>[0], ItemKind]>([
    [{ type: "file", mimeType: "image/png", fileName: "a.png" }, "image"],
    [{ type: "file", mimeType: "", fileName: "README.MD" }, "document"],
    [{ type: "file", mimeType: "application/octet-stream", fileName: "x.bin" }, "other"],
    [{ type: "url", url: "https://youtu.be/dQw4w9WgXcQ" }, "video"],
    [{ type: "url", url: "https://example.com/file.PDF?dl=1" }, "pdf"],
    [{ type: "url", url: "https://example.com/post" }, "link"],
    [{ type: "text", text: "https://github.com/a/b" }, "code"],
    [{ type: "text", text: "www.example.com/path" }, "link"],
    [{ type: "text", text: "www.example.com/a.png" }, "image"],
    [{ type: "text", text: "remember the milk" }, "note"],
    [{ type: "text", text: "javascript:alert(1)" }, "note"],
    [{ type: "text", text: "ftp://x.com" }, "note"],
    [{ type: "text", text: "example" }, "note"],
    [{ type: "text", text: "hello world https://x.com" }, "note"],
    [{ type: "text", text: "" }, "note"],
  ])("%j -> %s", (input, expected) => {
    expect(detectKind(input)).toBe(expected);
  });
});
