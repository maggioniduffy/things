// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const STYLESHEETS: Record<string, string> = {
  tailwindcss: "node_modules/tailwindcss/index.css",
  "tw-animate-css": "node_modules/tw-animate-css/dist/tw-animate.css",
};

/** Builds the real globals.css with Tailwind for the given class candidates. */
async function buildCss(candidates: string[]): Promise<string> {
  const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
  const compiler = await compile(css, {
    base: path.join(ROOT, "src/app"),
    async loadStylesheet(id, base) {
      const file = STYLESHEETS[id];
      if (!file) throw new Error(`Unexpected stylesheet import: ${id}`);
      return {
        path: path.join(ROOT, file),
        base,
        content: fs.readFileSync(path.join(ROOT, file), "utf8"),
      };
    },
  });
  return compiler.build(candidates);
}

/** Declarations of the first rule whose selector is exactly `selector`. */
function declarations(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`No rule for ${selector}`);
  return match[1] ?? "";
}

// The drawer title field uses `text-card` (17px) next to `text-ink`. When a `--color-card` token
// existed, Tailwind compiled `text-card` to `color: var(--card)` (translucent white), so the title
// text was invisible on the drawer's light surface while editing.
describe("drawer title field CSS", () => {
  it("compiles text-card to a font size only, so it never overrides the text-ink color", async () => {
    const css = await buildCss(["text-card", "sm:text-card", "text-ink"]);

    for (const selector of [".text-card", ".sm\\:text-card"]) {
      const body = declarations(css, selector);
      expect(body).toContain("font-size: var(--text-card)");
      expect(body).not.toMatch(/(^|[\s;])color\s*:/);
    }
    expect(declarations(css, ".text-ink")).toContain("color: var(--color-ink)");
  });
});
