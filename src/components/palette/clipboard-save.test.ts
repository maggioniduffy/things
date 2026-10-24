import { describe, expect, it } from "vitest";
import { ClipboardDeniedError, readClipboardRequests } from "./clipboard-save";

function clipboardItem(parts: Record<string, Blob | string>) {
  return {
    types: Object.keys(parts),
    getType: async (type: string) => {
      const part = parts[type];
      return part instanceof Blob ? part : new Blob([part ?? ""], { type });
    },
  };
}

const denied = () => Promise.reject(new DOMException("denied", "NotAllowedError"));

describe("readClipboardRequests", () => {
  it("turns plain text into one note", async () => {
    const result = await readClipboardRequests({
      read: async () => [clipboardItem({ "text/plain": "remember the milk" })],
    });
    expect(result).toEqual({
      requests: [{ type: "note", text: "remember the milk" }],
      capped: false,
    });
  });

  it("turns a URL into a link request", async () => {
    const result = await readClipboardRequests({
      read: async () => [clipboardItem({ "text/plain": "https://example.com/post" })],
    });
    expect(result.requests).toEqual([{ type: "url", url: "https://example.com/post" }]);
  });

  it("prefers a uri-list over text, like a paste does", async () => {
    const result = await readClipboardRequests({
      read: async () => [
        clipboardItem({ "text/uri-list": "https://a.example/", "text/plain": "A page" }),
      ],
    });
    expect(result.requests).toEqual([{ type: "url", url: "https://a.example/" }]);
  });

  it("turns an image blob into a file request named after its type", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const result = await readClipboardRequests({
      read: async () => [clipboardItem({ "image/png": blob, "text/plain": "ignored" })],
    });
    expect(result.requests).toHaveLength(1);
    const request = result.requests[0];
    expect(request?.type).toBe("file");
    if (request?.type === "file") {
      expect(request.file.name).toBe("image.png");
      expect(request.file.type).toBe("image/png");
    }
  });

  it("falls back to readText when read is missing or fails", async () => {
    const readText = async () => "https://example.com/";
    expect((await readClipboardRequests({ readText })).requests).toEqual([
      { type: "url", url: "https://example.com/" },
    ]);
    expect((await readClipboardRequests({ read: denied, readText })).requests).toEqual([
      { type: "url", url: "https://example.com/" },
    ]);
  });

  it("returns nothing for an empty clipboard", async () => {
    expect(await readClipboardRequests({ read: async () => [] })).toEqual({
      requests: [],
      capped: false,
    });
    expect((await readClipboardRequests({ readText: async () => "  " })).requests).toEqual([]);
  });

  it("throws ClipboardDeniedError when permission is denied everywhere", async () => {
    await expect(readClipboardRequests({ read: denied, readText: denied })).rejects.toBeInstanceOf(
      ClipboardDeniedError,
    );
    await expect(readClipboardRequests({})).rejects.toBeInstanceOf(ClipboardDeniedError);
  });
});
