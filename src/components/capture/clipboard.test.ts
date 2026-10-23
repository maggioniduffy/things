import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cappedCopy,
  MAX_CAPTURES,
  isExternalDrag,
  itemsFromDataTransfer,
  readDataTransfer,
  requestsFromText,
  saveRequests,
  type DataTransferLike,
} from "./clipboard";

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

function transfer(data: Record<string, string> = {}, files: File[] = []): DataTransferLike {
  return { files, getData: (format) => data[format] ?? "" };
}

function urls(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `https://example.com/${index}`);
}

describe("itemsFromDataTransfer", () => {
  it("returns a file request per file, ahead of any text", () => {
    const a = new File(["a"], "a.png", { type: "image/png" });
    const b = new File(["b"], "b.pdf", { type: "application/pdf" });
    expect(
      itemsFromDataTransfer(transfer({ "text/plain": "https://example.com" }, [a, b])),
    ).toEqual([
      { type: "file", file: a },
      { type: "file", file: b },
    ]);
  });

  it("skips directory-like entries but keeps empty files with an extension", () => {
    const directory = new File([], "photos", { type: "" });
    const nameless = new File([], "", { type: "" });
    const empty = new File([], "empty.txt", { type: "" });
    const typed = new File([], "blank", { type: "text/plain" });
    expect(
      itemsFromDataTransfer(transfer({}, [directory, nameless, empty, typed])).map((request) =>
        request.type === "file" ? request.file.name : null,
      ),
    ).toEqual(["empty.txt", "blank"]);
  });

  it("falls through to text when every file was skipped", () => {
    const directory = new File([], "photos", { type: "" });
    expect(itemsFromDataTransfer(transfer({ "text/plain": "hello" }, [directory]))).toEqual([
      { type: "note", text: "hello" },
    ]);
  });

  it("reads text/uri-list, ignoring comments and blank lines", () => {
    const list = "# a comment\r\nhttps://a.example/x\r\n\r\nhttps://b.example/y\r\n# another\r\n";
    expect(itemsFromDataTransfer(transfer({ "text/uri-list": list }))).toEqual([
      { type: "url", url: "https://a.example/x" },
      { type: "url", url: "https://b.example/y" },
    ]);
  });

  it("prefers uri-list over plain text", () => {
    expect(
      itemsFromDataTransfer(
        transfer({ "text/uri-list": "https://a.example/", "text/plain": "A page title" }),
      ),
    ).toEqual([{ type: "url", url: "https://a.example/" }]);
  });

  it("uses plain text when the uri-list holds no URL", () => {
    expect(
      itemsFromDataTransfer(transfer({ "text/uri-list": "# nothing", "text/plain": "a note" })),
    ).toEqual([{ type: "note", text: "a note" }]);
  });

  it("makes one link per line when every plain-text line is a URL", () => {
    expect(
      itemsFromDataTransfer(
        transfer({
          "text/plain": "https://a.example/\n\n  www.b.example/path  \r\nhttps://c.example",
        }),
      ),
    ).toEqual([
      { type: "url", url: "https://a.example/" },
      { type: "url", url: "https://www.b.example/path" },
      { type: "url", url: "https://c.example/" },
    ]);
  });

  it("makes one note out of mixed text", () => {
    const text = "Read this:\nhttps://a.example/\nthanks";
    expect(itemsFromDataTransfer(transfer({ "text/plain": text }))).toEqual([
      { type: "note", text },
    ]);
  });

  it("makes a note out of a long list of URLs (over 20 lines)", () => {
    const text = urls(21).join("\n");
    expect(itemsFromDataTransfer(transfer({ "text/plain": text }))).toEqual([
      { type: "note", text },
    ]);
  });

  it("makes a single URL line into a link", () => {
    expect(itemsFromDataTransfer(transfer({ "text/plain": "https://a.example/p" }))).toEqual([
      { type: "url", url: "https://a.example/p" },
    ]);
  });

  it("caps a gesture at 20 requests", () => {
    const list = urls(25).join("\n");
    const requests = itemsFromDataTransfer(transfer({ "text/uri-list": list }));
    expect(requests).toHaveLength(MAX_CAPTURES);
    expect(requests[0]).toEqual({ type: "url", url: "https://example.com/0" });
    expect(readDataTransfer(transfer({ "text/uri-list": list })).capped).toBe(true);
    expect(readDataTransfer(transfer({ "text/uri-list": urls(20).join("\n") })).capped).toBe(false);
  });

  it.each([
    ["nothing", transfer()],
    ["blank text", transfer({ "text/plain": " \n\t " })],
    ["a blank uri-list", transfer({ "text/uri-list": "\r\n" })],
  ])("returns nothing for %s", (_name, dataTransfer) => {
    expect(itemsFromDataTransfer(dataTransfer)).toEqual([]);
  });

  it("copes with a transfer whose getData throws", () => {
    const hostile: DataTransferLike = {
      files: [],
      getData: () => {
        throw new Error("denied");
      },
    };
    expect(itemsFromDataTransfer(hostile)).toEqual([]);
  });
});

describe("requestsFromText", () => {
  it("treats a bare www host as a link and other single words as notes", () => {
    expect(requestsFromText("www.example.com")).toEqual([
      { type: "url", url: "https://www.example.com/" },
    ]);
    expect(requestsFromText("example")).toEqual([{ type: "note", text: "example" }]);
  });
});

describe("isExternalDrag", () => {
  it.each([
    [["Files"], true],
    [["text/uri-list", "text/html"], true],
    [["text/plain"], true],
    [["application/x-dnd-kit"], false],
    [["text/html"], false],
    [[], false],
  ])("%j -> %s", (types, expected) => {
    expect(isExternalDrag(types)).toBe(expected);
  });

  it("handles a missing list", () => {
    expect(isExternalDrag(null)).toBe(false);
    expect(isExternalDrag(undefined)).toBe(false);
  });
});

describe("saveRequests", () => {
  beforeEach(() => toast.mockClear());

  function fakeCapture() {
    const calls: string[] = [];
    return {
      calls,
      capture: {
        captureLink: vi.fn(async (url: string) => void calls.push(`link ${url}`)),
        captureNote: vi.fn(async (text: string) => void calls.push(`note ${text}`)),
        captureFile: vi.fn(async (file: File) => void calls.push(`file ${file.name}`)),
      },
    };
  }

  it("starts them last to first so the first one ends up first on the board", () => {
    const { capture, calls } = fakeCapture();
    saveRequests(capture, {
      requests: [
        { type: "url", url: "https://a.example/" },
        { type: "note", text: "hello" },
        { type: "file", file: new File(["x"], "x.png") },
      ],
      capped: false,
    });
    expect(calls).toEqual(["file x.png", "note hello", "link https://a.example/"]);
    expect(toast).not.toHaveBeenCalled();
  });

  it("gives request i the canvas point plus i cascade steps, in the user's order", () => {
    const { capture } = fakeCapture();
    const file = new File(["x"], "x.png");
    saveRequests(
      capture,
      {
        requests: [
          { type: "url", url: "https://a.example/" },
          { type: "note", text: "hello" },
          { type: "note", text: "titled", title: "T" },
          { type: "file", file },
        ],
        capped: false,
      },
      { canvasAt: { x: 100, y: 200 } },
    );
    expect(capture.captureLink).toHaveBeenCalledWith("https://a.example/", {
      canvasAt: { x: 100, y: 200 },
    });
    expect(capture.captureNote).toHaveBeenCalledWith("hello", { canvasAt: { x: 124, y: 224 } });
    expect(capture.captureNote).toHaveBeenCalledWith("titled", {
      title: "T",
      tagNames: undefined,
      canvasAt: { x: 148, y: 248 },
    });
    expect(capture.captureFile).toHaveBeenCalledWith(file, { canvasAt: { x: 172, y: 272 } });
  });

  it("passes no extra argument without a canvas point", () => {
    const { capture } = fakeCapture();
    saveRequests(capture, {
      requests: [{ type: "url", url: "https://a.example/" }],
      capped: false,
    });
    expect(capture.captureLink).toHaveBeenCalledWith("https://a.example/");
  });

  it("toasts when the cap cut something off", () => {
    const { capture } = fakeCapture();
    saveRequests(capture, { requests: [{ type: "note", text: "n" }], capped: true });
    expect(toast).toHaveBeenCalledWith(cappedCopy());
    expect(cappedCopy()).toBe("Saved the first 20 items.");
  });
});
