import type { Collision, CollisionDescriptor, DroppableContainer } from "@dnd-kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "@/i18n/messages";
import { boardCollisionDetection, SIDEBAR_ZONE_ATTRIBUTE } from "./collision";
import { dropData, inboxTarget, type SidebarSortData } from "./targets";

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

const target = container(
  inboxTarget(messages.en.shell.views).id,
  dropData(inboxTarget(messages.en.shell.views)),
);
const cardA = container("a", { sortable: {} });
const cardB = container("b", { sortable: {} });
const rects = new Map<string | number, Rect>([
  [target.id, rect(0, 0, 200, 36)],
  [cardA.id, rect(300, 0, 200, 120)],
  [cardB.id, rect(520, 0, 200, 120)],
]);

function run(overrides: Record<string, unknown>): Collision[] {
  const args = {
    active: { id: "a", data: { current: {} } },
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

describe("boardCollisionDetection with a sidebar row", () => {
  const sortData = (section: SidebarSortData["section"], id: string): SidebarSortData => ({
    type: "sidebar-sort",
    section,
    id,
    label: id,
  });
  const rowA = container("sort:collections:a", sortData("collections", "a"));
  const rowB = container("sort:collections:b", sortData("collections", "b"));
  const rowC = container("sort:collections:c", sortData("collections", "c"));
  const viewRow = container("sort:smart-views:v", sortData("smart-views", "v"));
  const rowRects = new Map<string | number, Rect>([
    [target.id, rect(0, 0, 200, 36)],
    [rowA.id, rect(0, 100, 200, 36)],
    [rowB.id, rect(0, 140, 200, 36)],
    [rowC.id, rect(0, 180, 200, 36)],
    [viewRow.id, rect(0, 220, 200, 36)],
    [cardA.id, rect(300, 0, 200, 120)],
  ]);

  function runRow(collisionRect: Rect): Collision[] {
    const args = {
      active: { id: rowA.id, data: { current: sortData("collections", "a") } },
      collisionRect,
      droppableRects: rowRects,
      droppableContainers: [target, rowA, rowB, rowC, viewRow, cardA],
      pointerCoordinates: null,
    };
    return boardCollisionDetection(
      args as unknown as Parameters<typeof boardCollisionDetection>[0],
    );
  }

  it("a row only meets the rows of its own section", () => {
    // Centered on the smart view row, the closest same-section row is still a collection.
    const hits = runRow(rect(0, 220, 200, 36));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => String(hit.id).startsWith("sort:collections:"))).toBe(true);
    expect(hits[0]?.id).toBe(rowC.id);
  });

  it("picks the closest row by center, never a card drop target or a card", () => {
    expect(runRow(rect(0, 138, 200, 36))[0]?.id).toBe(rowB.id);
    expect(runRow(rect(0, 0, 200, 36)).map((hit) => hit.id)).not.toContain(target.id);
  });

  it("a card never lands on a sortable sidebar row", () => {
    const hits = boardCollisionDetection({
      active: { id: "a", data: { current: {} } },
      collisionRect: rect(0, 140, 200, 36),
      droppableRects: rowRects,
      droppableContainers: [target, rowA, rowB, cardA],
      pointerCoordinates: null,
    } as unknown as Parameters<typeof boardCollisionDetection>[0]);
    expect(hits.map((hit) => hit.id)).toEqual([cardA.id]);
  });
});
