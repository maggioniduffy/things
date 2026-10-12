import { describe, expect, it } from "vitest";
import { keyBefore } from "./order";

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
