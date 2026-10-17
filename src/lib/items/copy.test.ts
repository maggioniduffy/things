import { describe, expect, it } from "vitest";
import { makeItem } from "@/test/fixtures";
import {
  buildClipboard,
  buildCopyRows,
  copyLine,
  duplicatePlacements,
  pastePlacements,
  type CopiedCard,
} from "./copy";

const USER = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-05-05T00:00:00.000Z";

function card(id: string, x: number, y: number, extra = {}): CopiedCard {
  return { item: makeItem({ id, ...extra }), x, y, w: 100, h: 50 };
}

function ids() {
  let n = 0;
  return () => `new-${(n += 1)}`;
}

describe("copyLine", () => {
  it("uses the URL for links, the text for notes, the name for files", () => {
    expect(copyLine(makeItem({ kind: "link", url: "https://a.test", title: "A" }))).toBe(
      "https://a.test",
    );
    expect(copyLine(makeItem({ kind: "note", note: " Buy milk ", title: "T" }))).toBe("Buy milk");
    expect(copyLine(makeItem({ kind: "note", note: null, title: "Only title" }))).toBe(
      "Only title",
    );
    expect(
      copyLine(makeItem({ kind: "image", file_path: "u/i/p.png", title: "p", file_name: "p.png" })),
    ).toBe("p");
    expect(copyLine(makeItem({ kind: "note", note: "", title: null }))).toBe("Untitled");
  });
});

describe("buildClipboard", () => {
  it("is null without cards", () => {
    expect(buildClipboard([])).toBeNull();
  });

  it("stores offsets from the bounding box and one line per card", () => {
    const clip = buildClipboard([
      card("a", 100, 200, { kind: "note", note: "one" }),
      card("b", 300, 260, { kind: "note", note: "two" }),
    ]);
    expect(clip).toEqual({
      entries: [
        { id: "a", dx: 0, dy: 0 },
        { id: "b", dx: 200, dy: 60 },
      ],
      text: "one\ntwo",
      width: 300,
      height: 110,
    });
  });
});

describe("placements", () => {
  it("pastes with the bounding box centered on the point, keeping offsets", () => {
    const clip = buildClipboard([card("a", 100, 200), card("b", 300, 260)]);
    if (!clip) throw new Error("no clipboard");
    // Box is 300 x 110: centered on (1000, 500) it starts at (850, 445).
    expect(pastePlacements(clip, { x: 1000, y: 500 })).toEqual([
      { id: "a", x: 850, y: 445 },
      { id: "b", x: 1050, y: 505 },
    ]);
  });

  it("snaps the bounding box corner when asked, keeping offsets", () => {
    const clip = buildClipboard([card("a", 100, 200), card("b", 300, 260)]);
    if (!clip) throw new Error("no clipboard");
    // Unsnapped corner is (853, 447); on the 8 px grid that is (856, 448).
    expect(pastePlacements(clip, { x: 1003, y: 502, snap: true })).toEqual([
      { id: "a", x: 856, y: 448 },
      { id: "b", x: 1056, y: 508 },
    ]);
  });

  it("duplicates 16 px down and right", () => {
    expect(duplicatePlacements([card("a", 10, 20)])).toEqual([{ id: "a", x: 26, y: 36 }]);
  });
});

describe("buildCopyRows", () => {
  const POSITIONS = ["a2", "a3", "a4"];
  const options = {
    userId: USER,
    collectionId: "col-1",
    z: 7,
    now: NOW,
  };

  it("makes fresh, unread, unfavorited rows on the target canvas", () => {
    const source = makeItem({
      id: "orig",
      is_read: true,
      is_favorite: true,
      archived_at: NOW,
      collection_id: null,
      title: "Keep me",
      note: "n",
      url: "https://x.test",
      metadata: { a: 1 },
      canvas_w: 300,
      canvas_h: 200,
      created_at: "2020-01-01T00:00:00Z",
    });
    const { rows, tags } = buildCopyRows(
      [{ item: source, tagIds: ["t1", "t2"], x: 5, y: 6 }],
      POSITIONS,
      {
        ...options,
        newId: ids(),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "new-1",
      user_id: USER,
      collection_id: "col-1",
      canvas_x: 5,
      canvas_y: 6,
      canvas_w: 300,
      canvas_h: 200,
      canvas_z: 7,
      is_read: false,
      is_favorite: false,
      archived_at: null,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      title: "Keep me",
      note: "n",
      url: "https://x.test",
      metadata: { a: 1 },
    });
    expect(tags).toEqual([
      { item_id: "new-1", tag_id: "t1", user_id: USER },
      { item_id: "new-1", tag_id: "t2", user_id: USER },
    ]);
  });

  it("uses a null collection for the Inbox and stacks copies upward", () => {
    const { rows } = buildCopyRows(
      [
        { item: makeItem({ id: "a" }), tagIds: [], x: 0, y: 0 },
        { item: makeItem({ id: "b" }), tagIds: [], x: 0, y: 0 },
      ],
      POSITIONS,
      { ...options, collectionId: null, newId: ids() },
    );
    expect(rows.map((row) => row.collection_id)).toEqual([null, null]);
    expect(rows.map((row) => row.canvas_z)).toEqual([7, 8]);
  });

  it("gives each copy the reserved position at its index", () => {
    const { rows } = buildCopyRows(
      ["a", "b", "c"].map((id) => ({ item: makeItem({ id }), tagIds: [], x: 0, y: 0 })),
      POSITIONS,
      { ...options, newId: ids() },
    );
    expect(rows.map((row) => row.position)).toEqual(POSITIONS);
  });

  it("rewrites file and thumbnail paths to the new item", () => {
    const file = makeItem({
      id: "orig",
      user_id: "someone",
      kind: "image",
      file_name: "My photo.png",
      file_path: "someone/orig/My_photo.png",
      thumbnail_path: "someone/orig/.thumb.webp",
    });
    const { rows, files } = buildCopyRows([{ item: file, tagIds: [], x: 0, y: 0 }], POSITIONS, {
      ...options,
      newId: ids(),
    });
    expect(rows[0]?.file_path).toBe(`${USER}/new-1/My_photo.png`);
    expect(rows[0]?.thumbnail_path).toBe(`${USER}/new-1/.thumb.webp`);
    expect(files).toEqual([
      { from: "someone/orig/My_photo.png", to: `${USER}/new-1/My_photo.png` },
      { from: "someone/orig/.thumb.webp", to: `${USER}/new-1/.thumb.webp` },
    ]);
  });

  it("leaves thumbnail null when the source had none", () => {
    const file = makeItem({
      kind: "pdf",
      file_name: "a.pdf",
      file_path: "u/x/a.pdf",
      thumbnail_path: null,
    });
    const { rows, files } = buildCopyRows(
      [{ item: file, tagIds: [], x: 0, y: 0 }],
      POSITIONS,
      options,
    );
    expect(rows[0]?.thumbnail_path).toBeNull();
    expect(files).toHaveLength(1);
  });
});
