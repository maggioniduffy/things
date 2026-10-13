/**
 * Collection colors as stored in `collections.color` (the DB check allows exactly these).
 * Each maps to the `--color-aurora-<name>` token.
 */
export const AURORA_COLORS = ["pink", "violet", "blue", "red", "coral", "olive"] as const;

export type AuroraColor = (typeof AURORA_COLORS)[number];

export function isAuroraColor(value: unknown): value is AuroraColor {
  return typeof value === "string" && (AURORA_COLORS as readonly string[]).includes(value);
}

/** The CSS color of a stored token name, or undefined for none (or a name we do not know). */
export function auroraColorVar(color: string | null | undefined): string | undefined {
  return isAuroraColor(color) ? `var(--color-aurora-${color})` : undefined;
}

/** "violet" -> "Violet", for labels. */
export function auroraColorLabel(color: AuroraColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export const MAX_COLLECTION_NAME_LENGTH = 60;

/** A typed collection name as stored: whitespace collapsed and trimmed. */
export function normalizeCollectionName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function isValidCollectionName(name: string): boolean {
  return name !== "" && [...name].length <= MAX_COLLECTION_NAME_LENGTH;
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : [...text];
}

/**
 * The emoji field: empty means none (`null`), exactly one grapheme is kept, anything longer is
 * rejected (`undefined`). Whether that grapheme really is an emoji is the user's business.
 */
export function parseEmoji(raw: string): string | null | undefined {
  const text = raw.trim();
  if (text === "") return null;
  return graphemes(text).length === 1 ? text : undefined;
}
