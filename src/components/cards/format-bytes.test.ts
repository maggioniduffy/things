import { describe, expect, it } from "vitest";
import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  it("formats bytes, KB, MB and GB", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(812, "en")).toBe("812 B");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(34 * 1024, "en")).toBe("34 KB");
    expect(formatBytes(1.2 * 1024 * 1024, "en")).toBe("1.2 MB");
    expect(formatBytes(3 * 1024 ** 3, "en")).toBe("3 GB");
  });

  it("drops a trailing .0", () => {
    expect(formatBytes(2 * 1024 * 1024, "en")).toBe("2 MB");
  });

  it("uses the locale decimal separator", () => {
    expect(formatBytes(1536, "es")).toBe("1,5 KB");
  });

  it("returns null for missing or invalid sizes", () => {
    expect(formatBytes(null, "en")).toBeNull();
    expect(formatBytes(undefined, "en")).toBeNull();
    expect(formatBytes(-1, "en")).toBeNull();
    expect(formatBytes(Number.NaN, "en")).toBeNull();
  });
});
