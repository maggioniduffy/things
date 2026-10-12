import { describe, expect, it } from "vitest";
import { ITEM_KINDS } from "@/lib/views";
import { KIND_LABELS, kindPluralLabel, kindPluralLowercase, kindSingularLabel } from "./kinds";

describe("kinds", () => {
  it("labels every item kind", () => {
    for (const kind of ITEM_KINDS) {
      expect(KIND_LABELS[kind].singular).not.toBe("");
      expect(KIND_LABELS[kind].plural).not.toBe("");
    }
  });

  it("uses the plural labels from the sidebar spec", () => {
    expect(ITEM_KINDS.map(kindPluralLabel)).toEqual([
      "Links",
      "Articles",
      "Videos",
      "Images",
      "PDFs",
      "Documents",
      "Notes",
      "Audio",
      "Code",
      "Other",
    ]);
  });

  it("has singular labels", () => {
    expect(kindSingularLabel("pdf")).toBe("PDF");
    expect(kindSingularLabel("note")).toBe("Note");
  });

  it("lower-cases plurals except PDFs", () => {
    expect(kindPluralLowercase("link")).toBe("links");
    expect(kindPluralLowercase("pdf")).toBe("PDFs");
  });
});
