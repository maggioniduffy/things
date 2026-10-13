import { describe, expect, it } from "vitest";
import { noteTagging, parseHashtags } from "./parse";

describe("parseHashtags", () => {
  const cases: [string, string, string[], string][] = [
    ["a trailing tag", "Read later #thesis", ["thesis"], "Read later"],
    ["several tags, any position", "#a1 hello #b2 world", ["a1", "b2"], "hello world"],
    ["no tags", "Just a title", [], "Just a title"],
    ["empty text", "", [], ""],
    ["only a tag", "#ux", ["ux"], ""],
    ["a bare hash", "# heading", [], "# heading"],
    ["a numeric token", "Issue #1 and #42", [], "Issue #1 and #42"],
    ["digits plus a letter", "#2fast", ["2fast"], ""],
    ["underscores and dashes", "#to_read #deep-dive", ["to_read", "deep-dive"], ""],
    [
      "a URL fragment",
      "see https://example.com/page#section ok",
      [],
      "see https://example.com/page#section ok",
    ],
    ["a URL fragment after a slash", "a/#top", [], "a/#top"],
    ["an HTML entity", "it&#39;s fine #ok", ["ok"], "it&#39;s fine"],
    ["a hash glued to a word", "issue#12 foo#bar", [], "issue#12 foo#bar"],
    ["unicode letters", "Lecture #Étude #日本語 #naïve", ["Étude", "日本語", "naïve"], "Lecture"],
    ["tag at the start of a line", "one\n#two three", ["two"], "one three"],
    ["after punctuation", "(#alpha), [#beta]", ["alpha", "beta"], "(), []"],
    ["ending punctuation is not part of the name", "Wow #cool!", ["cool"], "Wow !"],
    ["double hash", "##nope", [], "##nope"],
  ];

  it.each(cases)("%s", (_label, input, names, text) => {
    expect(parseHashtags(input)).toEqual({ names, text });
  });

  it("dedupes case-insensitively and keeps the first casing", () => {
    expect(parseHashtags("#Thesis a #thesis b #THESIS #ux")).toEqual({
      names: ["Thesis", "ux"],
      text: "a b",
    });
  });

  it("keeps a token longer than 50 characters as plain text", () => {
    const long = "a".repeat(51);
    expect(parseHashtags(`x #${long}`)).toEqual({ names: [], text: `x #${long}` });
    const ok = "a".repeat(50);
    expect(parseHashtags(`x #${ok}`)).toEqual({ names: [ok], text: "x" });
  });

  it("collapses whitespace", () => {
    expect(parseHashtags("  a   #t \t b  ").text).toBe("a b");
  });
});

describe("noteTagging", () => {
  it("titles a single line without its tags", () => {
    expect(noteTagging("Read later #Thesis #ux")).toEqual({
      title: "Read later",
      tagNames: ["Thesis", "ux"],
    });
  });

  it("derives nothing without tags", () => {
    expect(noteTagging("Just a note")).toEqual({});
    expect(noteTagging("Issue #1")).toEqual({});
  });

  it("keeps the tags but no title for a multi-line note", () => {
    expect(noteTagging("first line\nsecond #ux")).toEqual({ tagNames: ["ux"] });
  });

  it("keeps the tags but no title when only tags are left", () => {
    expect(noteTagging("#ux #thesis")).toEqual({ tagNames: ["ux", "thesis"] });
  });
});
