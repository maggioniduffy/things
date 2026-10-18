/** Background colors a note can have. `null` (no color) keeps the default coral look. */
export const NOTE_COLORS = [
  "pink",
  "violet",
  "blue",
  "red",
  "coral",
  "olive",
  "white",
  "graphite",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type NoteColorStyle = {
  label: string;
  /** Card background. Aurora colors are a tint so dark ink keeps AA contrast. */
  surfaceClassName: string;
  /** True when the surface is dark and the card needs inverse ink. */
  inverse: boolean;
  /** Solid fill of the round swatch in the pickers. */
  swatchClassName: string;
};

// Class names are written out in full so Tailwind can see them.
export const NOTE_COLOR_STYLES: Record<NoteColor, NoteColorStyle> = {
  pink: {
    label: "Pink",
    surfaceClassName: "bg-aurora-pink/30",
    inverse: false,
    swatchClassName: "bg-aurora-pink",
  },
  violet: {
    label: "Violet",
    surfaceClassName: "bg-aurora-violet/30",
    inverse: false,
    swatchClassName: "bg-aurora-violet",
  },
  blue: {
    label: "Blue",
    surfaceClassName: "bg-aurora-blue/30",
    inverse: false,
    swatchClassName: "bg-aurora-blue",
  },
  red: {
    label: "Red",
    surfaceClassName: "bg-aurora-red/30",
    inverse: false,
    swatchClassName: "bg-aurora-red",
  },
  coral: {
    label: "Coral",
    surfaceClassName: "bg-aurora-coral/30",
    inverse: false,
    swatchClassName: "bg-aurora-coral",
  },
  olive: {
    label: "Olive",
    surfaceClassName: "bg-aurora-olive/30",
    inverse: false,
    swatchClassName: "bg-aurora-olive",
  },
  white: {
    label: "White",
    surfaceClassName: "bg-note-white",
    inverse: false,
    swatchClassName: "bg-note-white",
  },
  graphite: {
    label: "Graphite",
    surfaceClassName: "bg-note-graphite",
    inverse: true,
    swatchClassName: "bg-note-graphite",
  },
};

/** What a note without a color looks like. */
export const DEFAULT_NOTE_STYLE: NoteColorStyle = {
  label: "Default",
  surfaceClassName: "bg-aurora-coral/20",
  inverse: false,
  swatchClassName: "bg-aurora-coral/20",
};

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}

/** Style of a stored `items.color` value; anything unknown falls back to the default. */
export function noteColorStyle(value: unknown): NoteColorStyle {
  return isNoteColor(value) ? NOTE_COLOR_STYLES[value] : DEFAULT_NOTE_STYLE;
}
