import { describe, expect, it } from "vitest";
import { keyAfter, keyBefore, needsUnloadedPosition, planMove } from "./order";

describe("keyBefore", () => {
  it("returns the first key when there is nothing to go before", () => {
    expect(keyBefore(null)).toBe("a0");
  });

  it("sorts strictly before the key it is given", () => {
    expect(keyBefore("a0") < "a0").toBe(true);
    expect(keyBefore("a5") < "a5").toBe(true);
  });

  it("stays strictly decreasing across 50 successive calls, starting from null", () => {
    let previous = keyBefore(null);
    for (let i = 0; i < 50; i += 1) {
      const next = keyBefore(previous);
      expect(next < previous).toBe(true);
      previous = next;
    }
  });
});

describe("keyAfter", () => {
  it("returns the first key when there is nothing to go after", () => {
    expect(keyAfter(null)).toBe("a0");
  });

  it("sorts strictly after the key it is given", () => {
    expect(keyAfter("a0") > "a0").toBe(true);
    expect(keyAfter("a5") > "a5").toBe(true);
  });

  it("stays strictly increasing across 50 successive calls, starting from null", () => {
    let previous = keyAfter(null);
    for (let i = 0; i < 50; i += 1) {
      const next = keyAfter(previous);
      expect(next > previous).toBe(true);
      previous = next;
    }
  });
});

describe("planMove", () => {
  const rows = (...positions: string[]) =>
    positions.map((position, index) => ({ id: `id${index}`, position }));

  it("writes one key between the new neighbours", () => {
    const list = rows("a0", "a1", "a2", "a3");
    const [update, ...rest] = planMove(list, "id0", 2);
    expect(rest).toEqual([]);
    expect(update?.id).toBe("id0");
    expect(update!.position > "a2" && update!.position < "a3").toBe(true);
  });

  it("moves to the very start with a key before the first row", () => {
    const [update] = planMove(rows("a0", "a1", "a2"), "id2", 0);
    expect(update!.position < "a0").toBe(true);
  });

  it("is a no-op when the row lands where it was", () => {
    expect(planMove(rows("a0", "a1"), "id1", 1)).toEqual([]);
    expect(planMove(rows("a0", "a1"), "missing", 0)).toEqual([]);
  });

  it("uses the first unloaded row as the next neighbour at the end of the loaded rows", () => {
    const list = rows("a0", "a1", "a2");
    expect(needsUnloadedPosition(list, "id0", 2, true)).toBe(true);
    expect(needsUnloadedPosition(list, "id0", 2, false)).toBe(false);
    expect(needsUnloadedPosition(list, "id2", 1, true)).toBe(false);
    const [update] = planMove(list, "id0", 2, "a3");
    expect(update!.position > "a2" && update!.position < "a3").toBe(true);
  });

  it("re-keys the moved row and the tied run when neighbours share a position", () => {
    const list = rows("a0", "a1", "a1", "a1", "a2");
    // Move id0 to index 2: after = a1(id1) a1(id2)->moved? build explicitly
    const plan = planMove(list, "id0", 1);
    // after: id1(a1) id0 id2(a1) id3(a1) id4(a2); prev a1 === next a1
    expect(plan.map((u) => u.id)).toEqual(["id0", "id2", "id3"]);
    const keys = plan.map((u) => u.position);
    expect(keys.every((k, i) => i === 0 || keys[i - 1]! < k)).toBe(true);
    expect(keys[0]! > "a1" && keys[2]! < "a2").toBe(true);
  });

  it("re-keys only the moved row when tied at the end with nothing after", () => {
    const list = rows("a0", "a1", "a1");
    const plan = planMove(list, "id0", 1);
    expect(plan.map((u) => u.id)).toEqual(["id0", "id2"]);
    expect(plan.every((u) => u.position > "a1")).toBe(true);
  });
});
