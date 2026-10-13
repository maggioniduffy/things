import { generateKeyBetween } from "fractional-indexing";

/**
 * A `position` key that sorts before `first` (or the first key ever, `a0`, when there is none).
 * Always the default base-62 alphabet: the `position` columns are `collate "C"`.
 */
export function keyBefore(first: string | null): string {
  return generateKeyBetween(null, first);
}

/**
 * A `position` key that sorts after `last` (or the first key ever, `a0`, when there is none).
 * Same base-62 alphabet as `keyBefore`.
 */
export function keyAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}
