import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and skips falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("supports conditional object and array syntax", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b");
  });

  it("lets later Tailwind classes override conflicting earlier ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-sm text-red-500", "text-blue-500")).toBe("text-sm text-blue-500");
  });
});

describe("cn with token utilities", () => {
  it("keeps a token font size next to a token color", () => {
    expect(cn("text-body", "text-ink")).toBe("text-body text-ink");
    expect(cn("text-body", "text-meta")).toBe("text-meta");
  });

  it("lets a token radius override another", () => {
    expect(cn("rounded-control", "rounded-card")).toBe("rounded-card");
  });
});
