import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge that knows our token utilities. Without this, `text-body` (font size) and
 * `text-ink` (color) are read as the same group and one silently drops the other.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "body", "card", "section", "page"] }],
      rounded: [{ rounded: ["control", "card"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
