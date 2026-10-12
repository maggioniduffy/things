import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THUMB_WIDTH, createThumbnail, fitWidth } from "./thumbnails";

const renderPdfFirstPage = vi.hoisted(() => vi.fn());
vi.mock("./pdf-thumbnail", () => ({ renderPdfFirstPage }));

describe("fitWidth", () => {
  it.each([
    [1920, 1080, undefined, { width: 480, height: 270 }],
    [960, 480, undefined, { width: 480, height: 240 }],
    [480, 480, undefined, { width: 480, height: 480 }],
    [300, 200, undefined, { width: 300, height: 200 }], // never upscales
    [1, 1, undefined, { width: 1, height: 1 }],
    [4000, 3, undefined, { width: 480, height: 1 }], // height never drops below 1
    [1000, 500, 100, { width: 100, height: 50 }],
    [333, 777, 100, { width: 100, height: 233 }],
  ])("fitWidth(%d, %d, %s) -> %j", (w, h, max, expected) => {
    expect(fitWidth(w, h, max)).toEqual(expected);
  });

  it("returns 1x1 for degenerate sizes", () => {
    expect(fitWidth(0, 0)).toEqual({ width: 1, height: 1 });
    expect(fitWidth(-5, 10)).toEqual({ width: 1, height: 1 });
    expect(fitWidth(Number.NaN, 10)).toEqual({ width: 1, height: 1 });
    expect(THUMB_WIDTH).toBe(480);
  });
});

/** OffscreenCanvas stand-in that records what was drawn and encodes to a fake WebP blob. */
const drawn: { width: number; height: number; drawArgs: unknown[] }[] = [];
let encodeResult: Blob | Error = new Blob(["webp"], { type: "image/webp" });
class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return {
      drawImage: (...args: unknown[]) =>
        drawn.push({ width: this.width, height: this.height, drawArgs: args }),
    };
  }
  async convertToBlob(options: { type: string; quality: number }) {
    expect(options).toEqual({ type: "image/webp", quality: 0.8 });
    if (encodeResult instanceof Error) throw encodeResult;
    return encodeResult;
  }
}

beforeEach(() => {
  drawn.length = 0;
  encodeResult = new Blob(["webp"], { type: "image/webp" });
  renderPdfFirstPage.mockReset();
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createThumbnail: image", () => {
  it("scales the bitmap to 480 px wide, encodes WebP and closes the bitmap", async () => {
    const bitmap = { width: 1920, height: 1080, close: vi.fn() };
    const createImageBitmap = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const file = new File(["x"], "a.png", { type: "image/png" });

    const blob = await createThumbnail(file, "image");

    expect(createImageBitmap).toHaveBeenCalledWith(file);
    expect(blob?.type).toBe("image/webp");
    expect(drawn).toEqual([{ width: 480, height: 270, drawArgs: [bitmap, 0, 0, 480, 270] }]);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("does not upscale small images", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 100, height: 60, close: vi.fn() })),
    );
    await createThumbnail(new File(["x"], "a.png", { type: "image/png" }), "image");
    expect(drawn[0]).toMatchObject({ width: 100, height: 60 });
  });

  it("falls back to a <canvas> element when OffscreenCanvas is missing", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 960, height: 480, close: vi.fn() })),
    );
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
      expect([type, quality]).toEqual(["image/webp", 0.8]);
      callback(new Blob(["png"], { type: "image/png" })); // browsers may fall back to PNG
    });
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob };
    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue(canvas as unknown as HTMLElement);

    const blob = await createThumbnail(new File(["x"], "a.jpg", { type: "image/jpeg" }), "image");

    expect(createElement).toHaveBeenCalledWith("canvas");
    expect(canvas).toMatchObject({ width: 480, height: 240 });
    expect(blob?.type).toBe("image/png");
    createElement.mockRestore();
  });

  it("returns null for SVG without decoding it", async () => {
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const blob = await createThumbnail(
      new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }),
      "image",
    );
    expect(blob).toBeNull();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("returns null (and still closes the bitmap) when decoding or encoding fails", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad image")));
    expect(
      await createThumbnail(new File(["x"], "a.png", { type: "image/png" }), "image"),
    ).toBeNull();

    const bitmap = { width: 10, height: 10, close: vi.fn() };
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => bitmap),
    );
    encodeResult = new Error("encode failed");
    expect(
      await createThumbnail(new File(["x"], "a.png", { type: "image/png" }), "image"),
    ).toBeNull();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});

describe("createThumbnail: pdf", () => {
  it("renders page 1 through the lazy pdf module and encodes the canvas", async () => {
    renderPdfFirstPage.mockResolvedValue(new FakeOffscreenCanvas(480, 680));
    const file = new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" });

    const blob = await createThumbnail(file, "pdf");

    expect(renderPdfFirstPage).toHaveBeenCalledWith(expect.any(ArrayBuffer), 480);
    expect(blob?.type).toBe("image/webp");
  });

  it("returns null when pdfjs rejects (broken or encrypted PDF)", async () => {
    renderPdfFirstPage.mockRejectedValue(new Error("InvalidPDFException"));
    expect(
      await createThumbnail(new File(["nope"], "a.pdf", { type: "application/pdf" }), "pdf"),
    ).toBeNull();
  });
});

describe("createThumbnail: other kinds", () => {
  it.each(["note", "link", "article", "document", "audio", "code", "other"] as const)(
    "returns null for %s",
    async (kind) => {
      expect(await createThumbnail(new File(["x"], "f"), kind)).toBeNull();
    },
  );
});

describe("createThumbnail: video", () => {
  let created: HTMLVideoElement | undefined;
  let revoked: string[];

  beforeEach(() => {
    revoked = [];
    created = undefined;
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:video-1"),
        revokeObjectURL: (url: string) => revoked.push(url),
      }),
    );
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const element = realCreate(tag);
      if (tag === "video") {
        created = element as HTMLVideoElement;
        // jsdom does not implement media loading.
        created.load = vi.fn();
        Object.defineProperty(created, "videoWidth", { value: 1280 });
        Object.defineProperty(created, "videoHeight", { value: 720 });
      }
      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setDuration(video: HTMLVideoElement, duration: number) {
    Object.defineProperty(video, "duration", { value: duration, configurable: true });
  }

  it("seeks to min(1, duration / 2), draws the frame on seeked and revokes the URL", async () => {
    const pending = createThumbnail(new File(["v"], "a.mp4", { type: "video/mp4" }), "video");
    const video = created as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.preload).toBe("metadata");
    expect(video.playsInline).toBe(true);
    expect(video.getAttribute("src")).toBe("blob:video-1");

    setDuration(video, 30);
    video.dispatchEvent(new Event("loadeddata"));
    expect(video.currentTime).toBe(1);
    video.dispatchEvent(new Event("seeked"));

    const blob = await pending;
    expect(blob?.type).toBe("image/webp");
    expect(drawn[0]).toMatchObject({ width: 480, height: 270 });
    expect(revoked).toEqual(["blob:video-1"]);
  });

  it("seeks to half the duration for clips shorter than 2 s", async () => {
    const pending = createThumbnail(new File(["v"], "a.mp4", { type: "video/mp4" }), "video");
    const video = created as HTMLVideoElement;
    setDuration(video, 1.2);
    video.dispatchEvent(new Event("loadeddata"));
    expect(video.currentTime).toBeCloseTo(0.6);
    video.dispatchEvent(new Event("seeked"));
    expect((await pending)?.type).toBe("image/webp");
  });

  it("returns null on a media error", async () => {
    const pending = createThumbnail(new File(["v"], "a.mp4", { type: "video/mp4" }), "video");
    (created as HTMLVideoElement).dispatchEvent(new Event("error"));
    expect(await pending).toBeNull();
    expect(revoked).toEqual(["blob:video-1"]);
  });

  it("returns null after 5 s without a frame", async () => {
    vi.useFakeTimers();
    const pending = createThumbnail(new File(["v"], "a.mp4", { type: "video/mp4" }), "video");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toBeNull();
    expect(revoked).toEqual(["blob:video-1"]);
  });
});
