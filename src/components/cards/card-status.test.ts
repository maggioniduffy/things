import { describe, expect, it } from "vitest";
import { messages } from "@/i18n/messages";
import { makeItem } from "@/test/fixtures";
import { isStalePending, itemDisplayTitle } from "./card-status";

const card = messages.en.shell.card;

describe("itemDisplayTitle", () => {
  it("falls back from title to url to file name to Untitled", () => {
    expect(itemDisplayTitle(makeItem({ title: "Hello", url: "https://a.example" }), card)).toBe(
      "Hello",
    );
    expect(itemDisplayTitle(makeItem({ title: null, url: "https://a.example" }), card)).toBe(
      "https://a.example",
    );
    expect(itemDisplayTitle(makeItem({ title: null, file_name: "thesis.pdf" }), card)).toBe(
      "thesis.pdf",
    );
    expect(
      itemDisplayTitle(makeItem({ kind: "link", title: "", url: null, file_name: null }), card),
    ).toBe("Untitled");
    expect(itemDisplayTitle(makeItem({ kind: "note", title: "", note: "  " }), card)).toBe(
      "Empty note",
    );
  });

  it("uses the trimmed note text when there is no title, cut at about 140 characters", () => {
    expect(itemDisplayTitle(makeItem({ title: null, note: "  Buy milk\nand eggs  " }), card)).toBe(
      "Buy milk\nand eggs",
    );
    const long = itemDisplayTitle(makeItem({ title: null, note: "word ".repeat(100) }), card);
    expect(long.length).toBeLessThanOrEqual(141);
    expect(long.endsWith("…")).toBe(true);
    expect(itemDisplayTitle(makeItem({ title: "Named", note: "body" }), card)).toBe("Named");
  });
});

describe("isStalePending", () => {
  const NOW = Date.parse("2026-01-01T00:10:00Z");
  const link = (overrides: Partial<Parameters<typeof makeItem>[0]>) =>
    makeItem({ kind: "link", url: "https://a.example", enrich_status: "pending", ...overrides });

  it("is true for a pending link last updated more than 2 minutes ago", () => {
    expect(isStalePending(link({ updated_at: "2026-01-01T00:07:59Z" }), NOW)).toBe(true);
  });

  it("is false up to and including 2 minutes", () => {
    expect(isStalePending(link({ updated_at: "2026-01-01T00:08:00Z" }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: "2026-01-01T00:09:59Z" }), NOW)).toBe(false);
  });

  it("is false without a url, when not pending, or with an unreadable date", () => {
    const old = "2026-01-01T00:00:00Z";
    expect(isStalePending(link({ updated_at: old, url: null }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: old, enrich_status: "failed" }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: old, enrich_status: "done" }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: "not a date" }), NOW)).toBe(false);
  });

  it("covers a pending file whose upload is not running in this tab", () => {
    const old = "2026-01-01T00:00:00Z";
    const pendingFile = link({ updated_at: old, url: null, file_path: "u/i/a.pdf" });
    expect(isStalePending(pendingFile, NOW)).toBe(true);
    expect(isStalePending(pendingFile, NOW, true)).toBe(false);
  });
});
