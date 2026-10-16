import { describe, expect, it } from "vitest";
import { makeItem } from "@/test/fixtures";
import {
  autoPlace,
  defaultNodeSize,
  itemsToNodes,
  reconcileNodes,
  unplacedNodes,
  zOrderChanges,
  type ItemFlowNode,
} from "./layout";

describe("defaultNodeSize", () => {
  it.each([
    ["link", 280, 240],
    ["article", 280, 240],
    ["note", 240, 160],
    ["video", 240, 200],
    ["pdf", 240, 200],
    ["document", 240, 200],
    ["audio", 240, 200],
    ["code", 240, 200],
    ["other", 240, 200],
  ] as const)("%s is %i x %i", (kind, w, h) => {
    expect(defaultNodeSize(makeItem({ kind }))).toEqual({ w, h });
  });

  it("sizes an image from its aspect ratio at 320 wide", () => {
    const item = makeItem({ kind: "image", metadata: { width: 1600, height: 800 } });
    expect(defaultNodeSize(item)).toEqual({ w: 320, h: 160 });
  });

  it("clamps a very wide image to 120 tall", () => {
    const item = makeItem({ kind: "image", metadata: { width: 3000, height: 300 } });
    expect(defaultNodeSize(item)).toEqual({ w: 320, h: 120 });
  });

  it("falls back to 320 x 240 without usable dimensions", () => {
    expect(defaultNodeSize(makeItem({ kind: "image" }))).toEqual({ w: 320, h: 240 });
    expect(
      defaultNodeSize(makeItem({ kind: "image", metadata: { width: "big", height: 0 } })),
    ).toEqual({ w: 320, h: 240 });
  });

  it("prefers stored size, per dimension", () => {
    expect(defaultNodeSize(makeItem({ kind: "link", canvas_w: 500, canvas_h: 300 }))).toEqual({
      w: 500,
      h: 300,
    });
    expect(defaultNodeSize(makeItem({ kind: "link", canvas_w: 500 }))).toEqual({ w: 500, h: 240 });
  });
});

describe("autoPlace", () => {
  it("returns nothing for nothing", () => {
    expect(autoPlace([], []).size).toBe(0);
    expect(autoPlace([{ x: 0, y: 0, w: 10, h: 10 }], []).size).toBe(0);
  });

  it("stacks everything from (0, 0) when nothing is placed", () => {
    const placed = autoPlace(
      [],
      [
        { id: "a", w: 280, h: 240 },
        { id: "b", w: 240, h: 160 },
      ],
    );
    expect(placed.get("a")).toEqual({ x: 0, y: 0, w: 280, h: 240 });
    expect(placed.get("b")).toEqual({ x: 0, y: 264, w: 240, h: 160 });
  });

  it("starts right of the placed bounding box, at its top", () => {
    const placed = autoPlace(
      [
        { x: 100, y: 50, w: 200, h: 100 },
        { x: -40, y: -20, w: 100, h: 500 },
      ],
      [{ id: "a", w: 240, h: 200 }],
    );
    expect(placed.get("a")).toEqual({ x: 324, y: -20, w: 240, h: 200 });
  });

  it("is deterministic and keeps input order", () => {
    const input = [
      { id: "z", w: 10, h: 10 },
      { id: "a", w: 10, h: 10 },
    ];
    const first = autoPlace([], input);
    expect([...first.keys()]).toEqual(["z", "a"]);
    expect(autoPlace([], input)).toEqual(first);
  });
});

describe("itemsToNodes", () => {
  it("returns no nodes for no items", () => {
    expect(itemsToNodes([])).toEqual([]);
  });

  it("uses stored position, size and z", () => {
    const item = makeItem({
      id: "a",
      kind: "link",
      canvas_x: 10,
      canvas_y: 20,
      canvas_w: 400,
      canvas_h: 300,
      canvas_z: 7,
    });
    const [node] = itemsToNodes([item]);
    expect(node).toMatchObject({
      id: "a",
      type: "item",
      position: { x: 10, y: 20 },
      width: 400,
      height: 300,
      zIndex: 7,
      data: { item },
    });
  });

  it("auto-places unplaced items right of the placed ones with default sizes", () => {
    const placed = makeItem({
      id: "p",
      kind: "link",
      canvas_x: 0,
      canvas_y: 0,
      canvas_w: 300,
      canvas_h: 200,
    });
    const note = makeItem({ id: "n", kind: "note" });
    const pdf = makeItem({ id: "f", kind: "pdf" });
    const nodes = itemsToNodes([note, placed, pdf]);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    expect(nodes.map((node) => node.id)).toEqual(["n", "p", "f"]);
    expect(byId.p?.position).toEqual({ x: 0, y: 0 });
    expect(byId.n).toMatchObject({ position: { x: 324, y: 0 }, width: 240, height: 160 });
    expect(byId.f).toMatchObject({ position: { x: 324, y: 184 }, width: 240, height: 200 });
  });

  it("treats a half-set position as unplaced", () => {
    const [node] = itemsToNodes([makeItem({ id: "a", canvas_x: 5, canvas_y: null })]);
    expect(node?.position).toEqual({ x: 0, y: 0 });
  });
});

describe("reconcileNodes", () => {
  const a = makeItem({ id: "a", kind: "link", canvas_x: 0, canvas_y: 0 });
  const b = makeItem({ id: "b", kind: "note", canvas_x: 400, canvas_y: 0 });

  it("returns the same array when nothing changed", () => {
    const nodes = itemsToNodes([a, b]);
    expect(reconcileNodes(nodes, [a, b])).toBe(nodes);
  });

  it("keeps local position and size but takes the new item", () => {
    const nodes = itemsToNodes([a, b]);
    const moved: ItemFlowNode[] = nodes.map((node) =>
      node.id === "a" ? { ...node, position: { x: 999, y: 888 }, width: 500 } : node,
    );
    const patched = { ...a, title: "Renamed" };
    const next = reconcileNodes(moved, [patched, b]);
    expect(next[0]).toMatchObject({
      position: { x: 999, y: 888 },
      width: 500,
      data: { item: patched },
    });
    expect(next[1]).toBe(moved[1]);
  });

  it("drops removed items", () => {
    const nodes = itemsToNodes([a, b]);
    expect(reconcileNodes(nodes, [b]).map((node) => node.id)).toEqual(["b"]);
  });

  it("auto-places a new item right of the local content", () => {
    const nodes = itemsToNodes([a, b]).map((node) =>
      node.id === "b" ? { ...node, position: { x: 1000, y: 0 } } : node,
    );
    const fresh = makeItem({ id: "c", kind: "note" });
    const next = reconcileNodes(nodes, [a, b, fresh]);
    // b is a note: 240 wide, now at x = 1000.
    expect(next[2]).toMatchObject({ id: "c", position: { x: 1264, y: 0 } });
  });

  it("gives a new item with a stored position that position", () => {
    const fresh = makeItem({ id: "c", canvas_x: 5, canvas_y: 6 });
    const next = reconcileNodes(itemsToNodes([a]), [a, fresh]);
    expect(next[1]?.position).toEqual({ x: 5, y: 6 });
  });
});

describe("unplacedNodes", () => {
  it("lists the nodes whose item has no stored position", () => {
    const placed = makeItem({ id: "a", canvas_x: 0, canvas_y: 0 });
    const loose = makeItem({ id: "b" });
    const nodes = itemsToNodes([placed, loose]);
    expect(unplacedNodes(nodes).map((node) => node.id)).toEqual(["b"]);
  });
});

describe("zOrderChanges", () => {
  // a, b and c overlap each other; far is alone.
  const nodes = itemsToNodes([
    makeItem({ id: "a", canvas_x: 0, canvas_y: 0, canvas_w: 200, canvas_h: 200, canvas_z: 0 }),
    makeItem({ id: "b", canvas_x: 100, canvas_y: 100, canvas_w: 200, canvas_h: 200, canvas_z: 3 }),
    makeItem({ id: "c", canvas_x: 150, canvas_y: 150, canvas_w: 200, canvas_h: 200, canvas_z: 5 }),
    makeItem({ id: "far", canvas_x: 2000, canvas_y: 0, canvas_w: 200, canvas_h: 200, canvas_z: 9 }),
  ]);

  it("forward goes one step past the highest node it overlaps, ignoring far ones", () => {
    expect(zOrderChanges(nodes, new Set(["a"]), "forward")).toEqual(new Map([["a", 6]]));
  });

  it("backward goes one step below the lowest node it overlaps", () => {
    expect(zOrderChanges(nodes, new Set(["c"]), "backward")).toEqual(new Map([["c", -1]]));
  });

  it("front and back look at every other node", () => {
    expect(zOrderChanges(nodes, new Set(["a"]), "front")).toEqual(new Map([["a", 10]]));
    expect(zOrderChanges(nodes, new Set(["far"]), "back")).toEqual(new Map([["far", -1]]));
  });

  it("does nothing when the selection overlaps nothing or is already past the reference", () => {
    expect(zOrderChanges(nodes, new Set(["far"]), "forward").size).toBe(0);
    expect(zOrderChanges(nodes, new Set(["far"]), "front").size).toBe(0);
    expect(zOrderChanges(nodes, new Set(["a"]), "back").size).toBe(0);
    expect(zOrderChanges(nodes, new Set(), "front").size).toBe(0);
  });

  it("moves a selection as a group and keeps its internal order", () => {
    const changes = zOrderChanges(nodes, new Set(["a", "b"]), "forward");
    expect(changes).toEqual(
      new Map([
        ["a", 6],
        ["b", 9],
      ]),
    );
  });
});
