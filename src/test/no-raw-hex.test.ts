import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function sourceFiles(): string[] {
  return (fs.readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx|css)$/.test(f))
    .filter((f) => !/\.test\.(ts|tsx)$/.test(f))
    .filter((f) => path.basename(f) !== "globals.css")
    .map((f) => path.join(SRC, f));
}

describe("design tokens", () => {
  it("keeps raw hex colors out of src (tokens live in globals.css)", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(HEX)) {
        offenders.push(`${path.relative(SRC, file)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
