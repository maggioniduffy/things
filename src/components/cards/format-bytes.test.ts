import { describe, expect, it } from "vitest";
import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  it("formats bytes, KB, MB and GB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(812)).toBe("812 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(34 * 1024)).toBe("34 KB");
    expect(formatBytes(1.2 * 1024 * 1024)).toBe("1.2 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
  });

  it("drops a trailing .0", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("returns null for missing or invalid sizes", () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(undefined)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
    expect(formatBytes(Number.NaN)).toBeNull();
  });
});
