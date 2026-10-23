import { afterEach, describe, expect, it } from "vitest";
import { setActiveLocale } from "@/i18n/active";
import { ITEM_KINDS } from "@/lib/views";
import { kindLabels, kindPluralLabel, kindPluralLowercase, kindSingularLabel } from "./kinds";

describe("kinds", () => {
  afterEach(() => setActiveLocale("en"));

  it("labels every item kind", () => {
    for (const kind of ITEM_KINDS) {
      expect(kindLabels()[kind].singular).not.toBe("");
      expect(kindLabels()[kind].plural).not.toBe("");
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

  it("speaks Spanish in the es locale", () => {
    setActiveLocale("es");
    expect(kindPluralLabel("image")).toBe("Imágenes");
    expect(kindSingularLabel("link")).toBe("Enlace");
    expect(kindPluralLowercase("note")).toBe("notas");
    expect(kindPluralLowercase("pdf")).toBe("PDFs");
  });
});
