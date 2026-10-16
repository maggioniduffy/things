import { describe, expect, it } from "vitest";
import { bringToFront, sendToBack } from "./z-order";

const nodes = [{ id: "a", zIndex: 0 }, { id: "b", zIndex: 3 }, { id: "c", zIndex: 1 }, { id: "d" }];

describe("bringToFront", () => {
  it("puts one node above the highest other", () => {
    expect([...bringToFront(nodes, ["a"])]).toEqual([["a", 4]]);
  });

  it("keeps the relative order of several nodes", () => {
    // c (1) is below b (3): c gets 1 above max-of-others (0 here), b the next.
    expect([...bringToFront(nodes, ["b", "c"])]).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
  });

  it("starts at 0 when nothing else exists and ignores unknown ids", () => {
    expect([...bringToFront([{ id: "a", zIndex: 5 }], ["a", "zzz"])]).toEqual([["a", 0]]);
  });
});

describe("sendToBack", () => {
  it("puts nodes below the lowest other, keeping their order", () => {
    // Others: a (0), d (0) -> min 0; two nodes: -2 and -1.
    expect([...sendToBack(nodes, ["b", "c"])]).toEqual([
      ["c", -2],
      ["b", -1],
    ]);
  });

  it("handles a single node", () => {
    expect([...sendToBack(nodes, ["b"])]).toEqual([["b", -1]]);
  });
});

describe("neither touches nodes that were not chosen", () => {
  it("only returns the chosen ids", () => {
    expect([...bringToFront(nodes, ["a"]).keys()]).toEqual(["a"]);
    expect([...sendToBack(nodes, ["a"]).keys()]).toEqual(["a"]);
  });
});
