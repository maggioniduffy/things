import { describe, expect, it } from "vitest";
import { messages } from "@/i18n/messages";
import { ITEM_KINDS } from "@/lib/views";
import { kindPluralLabel, kindPluralLowercase, kindSingularLabel } from "./kinds";

const en = messages.en.shell.kinds;
const es = messages.es.shell.kinds;

describe("kinds", () => {
  it("labels every item kind", () => {
    for (const kind of ITEM_KINDS) {
      expect(en[kind].singular).not.toBe("");
      expect(en[kind].plural).not.toBe("");
    }
  });

  it("uses the plural labels from the sidebar spec", () => {
    expect(ITEM_KINDS.map((kind) => kindPluralLabel(en, kind))).toEqual([
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
    expect(kindSingularLabel(en, "pdf")).toBe("PDF");
    expect(kindSingularLabel(en, "note")).toBe("Note");
  });

  it("lower-cases plurals except PDFs", () => {
    expect(kindPluralLowercase(en, "link")).toBe("links");
    expect(kindPluralLowercase(en, "pdf")).toBe("PDFs");
  });

  it("speaks Spanish in the es locale", () => {
    expect(kindPluralLabel(es, "image")).toBe("Imágenes");
    expect(kindSingularLabel(es, "link")).toBe("Enlace");
    expect(kindPluralLowercase(es, "note")).toBe("notas");
    expect(kindPluralLowercase(es, "pdf")).toBe("PDFs");
  });
});
