import { describe, expect, it } from "vitest";
import type { BoardItem } from "@/lib/items/queries";
import { viewerKindOf } from "./file-viewer";

const item = (over: Partial<BoardItem>) =>
  ({ kind: "document", file_path: "u/1/a", file_name: null, mime_type: null, ...over }) as BoardItem;

describe("viewerKindOf", () => {
  it("reads PDFs, Markdown and text in the app", () => {
    expect(viewerKindOf(item({ kind: "pdf" }))).toBe("pdf");
    expect(viewerKindOf(item({ file_name: "notes.MD" }))).toBe("markdown");
    expect(viewerKindOf(item({ mime_type: "text/markdown" }))).toBe("markdown");
    expect(viewerKindOf(item({ file_name: "a.txt" }))).toBe("text");
  });

  it("leaves other files and items without a file to download", () => {
    expect(viewerKindOf(item({ file_name: "a.docx" }))).toBeNull();
    expect(viewerKindOf(item({ kind: "pdf", file_path: null }))).toBeNull();
  });
});
