/** Longest tag name, in characters (the `#` is not counted). */
export const MAX_TAG_LENGTH = 50;

// `#` not preceded by a word char, `/`, `&` or `#` (URL fragments, `&#39;`, `##`), then a run of letters,
// digits, `_` or `-`. The run is checked for a letter (and capped) in code.
const TOKEN = /(?<![\p{L}\p{N}_/&#])#([\p{L}\p{N}_-]+)/gu;
const HAS_LETTER = /\p{L}/u;

/**
 * The `#tags` in `text`, and `text` with those tokens removed and whitespace collapsed.
 * Names keep the casing of their first occurrence and are unique case-insensitively.
 * `#1` is not a tag (a name needs a letter) and a name over 50 characters is not a tag.
 */
export function parseHashtags(text: string): { names: string[]; text: string } {
  const names: string[] = [];
  const seen = new Set<string>();

  const stripped = text.replace(TOKEN, (token: string, name: string) => {
    if (!HAS_LETTER.test(name) || [...name].length > MAX_TAG_LENGTH) return token;
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
    return "";
  });

  return { names, text: stripped.replace(/\s+/g, " ").trim() };
}

/** Longest title a note gets from its own text (the drawer's title field has the same cap). */
const MAX_NOTE_TITLE = 300;

/**
 * What quick add derives from a note's text: its `#tags`, and, for a single line, a title made
 * of the text without them ("Read later #thesis" -> title "Read later"). Longer notes keep no
 * title; the text itself is never changed. Nothing is derived when there are no tags.
 */
export function noteTagging(text: string): { title?: string; tagNames?: string[] } {
  const { names, text: stripped } = parseHashtags(text);
  if (names.length === 0) return {};
  const singleLine = !/[\r\n]/.test(text.trim());
  const title =
    singleLine && stripped !== "" && stripped.length <= MAX_NOTE_TITLE ? stripped : undefined;
  return title === undefined ? { tagNames: names } : { title, tagNames: names };
}
