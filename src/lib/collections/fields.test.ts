import { describe, expect, it } from "vitest";
import { messages } from "@/i18n/messages";
import {
  auroraColorLabel,
  auroraColorVar,
  isValidCollectionName,
  normalizeCollectionName,
  parseEmoji,
} from "./fields";

describe("parseEmoji", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["📚", "📚"],
    [" 📚 ", "📚"],
    ["👩‍👩‍👧‍👦", "👩‍👩‍👧‍👦"], // one family grapheme made of several code points
    ["🇨🇭", "🇨🇭"],
    ["a", "a"],
    ["ab", undefined],
    ["📚📚", undefined],
  ])("%j -> %j", (input, expected) => {
    expect(parseEmoji(input)).toBe(expected);
  });
});

describe("aurora colors", () => {
  it("maps a token name to its CSS variable, and anything else to undefined", () => {
    expect(auroraColorVar("violet")).toBe("var(--color-aurora-violet)");
    expect(auroraColorVar("green")).toBeUndefined();
    expect(auroraColorVar(null)).toBeUndefined();
  });

  it("labels a token in sentence case", () => {
    expect(auroraColorLabel("olive", messages.en.shell.colors)).toBe("Olive");
  });
});

describe("collection names", () => {
  it("collapses whitespace and checks length", () => {
    expect(normalizeCollectionName("  My   list ")).toBe("My list");
    expect(isValidCollectionName("")).toBe(false);
    expect(isValidCollectionName("x".repeat(61))).toBe(false);
    expect(isValidCollectionName("ok")).toBe(true);
  });
});
