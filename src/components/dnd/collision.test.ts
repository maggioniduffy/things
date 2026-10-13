import type { Collision, CollisionDescriptor, DroppableContainer } from "@dnd-kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boardCollisionDetection, SIDEBAR_ZONE_ATTRIBUTE } from "./collision";
import { dropData, INBOX_TARGET } from "./targets";

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

function container(id: string, data: unknown): DroppableContainer {
  return {
    id,
    data: { current: data },
    disabled: false,
    node: { current: null },
    rect: { current: null },
  } as unknown as DroppableContainer;
}

const target = container(INBOX_TARGET.id, dropData(INBOX_TARGET));
const cardA = container("a", { sortable: {} });
const cardB = container("b", { sortable: {} });
const rects = new Map<string | number, Rect>([
  [target.id, rect(0, 0, 200, 36)],
  [cardA.id, rect(300, 0, 200, 120)],
  [cardB.id, rect(520, 0, 200, 120)],
]);

function run(overrides: Record<string, unknown>): Collision[] {
  const args = {
    active: { id: "a" },
    collisionRect: rect(520, 0, 200, 120),
    droppableRects: rects,
    droppableContainers: [target, cardA, cardB],
    pointerCoordinates: null,
    ...overrides,
  };
  return boardCollisionDetection(args as unknown as Parameters<typeof boardCollisionDetection>[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("boardCollisionDetection", () => {
  it("picks the sidebar target under the pointer", () => {
    const hits = run({ pointerCoordinates: { x: 50, y: 10 } });
    expect(hits.map((hit) => hit.id)).toEqual([target.id]);
  });

  it("falls back to the closest card by center when the pointer is in the board", () => {
    const hits = run({
      pointerCoordinates: { x: 530, y: 50 },
      collisionRect: rect(500, 0, 200, 120),
    });
    expect((hits as CollisionDescriptor[])[0]?.id).toBe("b");
    expect(hits.every((hit) => hit.id !== target.id)).toBe(true);
  });

  it("matches nothing over the sidebar but off every target, so a drop cannot reorder", () => {
    const zone = document.createElement("div");
    zone.setAttribute(SIDEBAR_ZONE_ATTRIBUTE, "");
    document.body.append(zone);
    document.elementsFromPoint = vi.fn(() => [zone]);
    expect(run({ pointerCoordinates: { x: 50, y: 200 } })).toEqual([]);
  });

  it("with the keyboard, a card moved onto a sidebar row targets it", () => {
    const hits = run({ collisionRect: rect(0, 0, 200, 120) });
    expect(hits.map((hit) => hit.id)).toEqual([target.id]);
  });

  it("with the keyboard, a card between cards sorts by center and never picks a target", () => {
    const hits = run({ collisionRect: rect(300, 0, 200, 120) });
    expect(hits[0]?.id).toBe("a");
  });
});
