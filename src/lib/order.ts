import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

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

/** A row as far as ordering is concerned. */
export type OrderedRow = { id: string; position: string };

/** One `position` write of a reorder. */
export type PositionUpdate = { id: string; position: string };

/** `rows` with the row at `from` moved to index `to` (a new array). */
export function moveRow<T>(rows: readonly T[], from: number, to: number): T[] {
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

type MoveLayout = {
  after: OrderedRow[];
  /** Index of the moved row in `after`. */
  at: number;
  /** Rows right after the moved one that share the next row's position (needs a re-key). */
  tiedRun: OrderedRow[];
};

function layoutOf(
  rows: readonly OrderedRow[],
  movedId: string,
  toIndex: number,
): MoveLayout | null {
  const from = rows.findIndex((row) => row.id === movedId);
  if (from === -1 || toIndex < 0 || toIndex >= rows.length || from === toIndex) return null;
  const after = moveRow(rows, from, toIndex);
  const prev = after[toIndex - 1];
  const next = after[toIndex + 1];
  const tiedRun: OrderedRow[] = [];
  if (prev && next && prev.position === next.position) {
    for (let i = toIndex + 1; i < after.length; i += 1) {
      const row = after[i];
      if (!row || row.position !== next.position) break;
      tiedRun.push(row);
    }
  }
  return { after, at: toIndex, tiedRun };
}

/**
 * Whether `planMove` needs the position of the first row that is not loaded yet: the moved row
 * lands at the end of the loaded rows (or a tied run reaches the end) while more pages exist.
 */
export function needsUnloadedPosition(
  rows: readonly OrderedRow[],
  movedId: string,
  toIndex: number,
  hasMore: boolean,
): boolean {
  if (!hasMore) return false;
  const layout = layoutOf(rows, movedId, toIndex);
  if (!layout) return false;
  if (layout.at === layout.after.length - 1) return true;
  return layout.tiedRun.length > 0 && layout.at + layout.tiedRun.length === layout.after.length - 1;
}

/**
 * The `position` writes that move row `movedId` to index `toIndex` of `rows` (sorted by
 * `position asc, id asc`). One write in the normal case: a key between the new neighbours.
 * Rows may share a position, which leaves no room between two tied neighbours: then the moved row
 * and the tied rows after the drop point get fresh keys (the only multi-row case). Empty when the
 * row lands where it was.
 *
 * `unloadedPosition` is the position of the first row after the loaded ones (null when there is
 * none); it is the "next" neighbour when the row is dropped after the last loaded one.
 */
export function planMove(
  rows: readonly OrderedRow[],
  movedId: string,
  toIndex: number,
  unloadedPosition: string | null = null,
): PositionUpdate[] {
  const layout = layoutOf(rows, movedId, toIndex);
  if (!layout) return [];
  const { after, at, tiedRun } = layout;
  const moved = after[at];
  if (!moved) return [];
  const prevPosition = after[at - 1]?.position ?? null;
  const next = after[at + 1];
  const nextPosition = next ? next.position : unloadedPosition;

  if (prevPosition !== null && nextPosition !== null && prevPosition === nextPosition) {
    // No key fits between two equal positions: re-key the moved row and the tied run after it.
    const run = next ? tiedRun : [];
    const beyond = after[at + 1 + run.length];
    const runPosition = prevPosition;
    let upper: string | null = beyond ? beyond.position : unloadedPosition;
    if (upper !== null && upper <= runPosition) upper = null;
    const keys = generateNKeysBetween(prevPosition, upper, 1 + run.length);
    return [moved, ...run].map((row, index) => ({ id: row.id, position: keys[index] ?? "" }));
  }

  return [{ id: moved.id, position: generateKeyBetween(prevPosition, nextPosition) }];
}
