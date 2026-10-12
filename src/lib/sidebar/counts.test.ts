import { describe, expect, it } from "vitest";
import { summarizeCounts, type ItemCountRow } from "./counts";

const COL = "c1111111-1111-4111-8111-111111111111";
const COL2 = "c2222222-2222-4222-8222-222222222222";

function row(overrides: Partial<ItemCountRow>): ItemCountRow {
  return {
    kind: "link",
    collection_id: null,
    is_read: false,
    is_favorite: false,
    archived: false,
    deleted: false,
    n: 1,
    ...overrides,
  };
}

const EMPTY = {
  inbox: 0,
  all: 0,
  unread: 0,
  favorites: 0,
  archive: 0,
  trash: 0,
  kinds: {},
  collections: {},
};

describe("summarizeCounts", () => {
  it("returns zeros for no rows", () => {
    expect(summarizeCounts([])).toEqual(EMPTY);
  });

  it("counts a live inbox item (null collection)", () => {
    expect(summarizeCounts([row({ n: 3 })])).toEqual({
      ...EMPTY,
      inbox: 3,
      all: 3,
      unread: 3,
      kinds: { link: 3 },
    });
  });

  it("counts a live collection item outside the inbox", () => {
    const c = summarizeCounts([row({ collection_id: COL, kind: "pdf", is_read: true, n: 2 })]);
    expect(c).toEqual({ ...EMPTY, all: 2, kinds: { pdf: 2 }, collections: { [COL]: 2 } });
  });

  it("counts favorites only when live", () => {
    const c = summarizeCounts([
      row({ is_favorite: true, is_read: true, n: 2 }),
      row({ is_favorite: true, is_read: true, archived: true, n: 5 }),
      row({ is_favorite: true, is_read: true, deleted: true, n: 7 }),
    ]);
    expect(c.favorites).toBe(2);
  });

  it("counts archived (not deleted) only in archive", () => {
    const c = summarizeCounts([row({ archived: true, collection_id: COL, kind: "note", n: 4 })]);
    expect(c).toEqual({ ...EMPTY, archive: 4 });
  });

  it("counts deleted rows in trash, archived or not, and nowhere else", () => {
    const c = summarizeCounts([
      row({ deleted: true, n: 2 }),
      row({ deleted: true, archived: true, n: 3 }),
    ]);
    expect(c).toEqual({ ...EMPTY, trash: 5 });
  });

  it("sums multiple rows per kind and collection, omitting zeros", () => {
    const c = summarizeCounts([
      row({ kind: "link", collection_id: COL, is_read: true, n: 2 }),
      row({ kind: "link", collection_id: COL, is_read: false, n: 3 }),
      row({ kind: "video", collection_id: COL2, is_read: true, n: 1 }),
      row({ kind: "image", n: 0 }),
      row({ kind: "code", collection_id: COL2, archived: true, n: 9 }),
    ]);
    expect(c.kinds).toEqual({ link: 5, video: 1 });
    expect(c.collections).toEqual({ [COL]: 5, [COL2]: 1 });
    expect(c.all).toBe(6);
    expect(c.unread).toBe(3);
    expect(c.inbox).toBe(0);
    expect(c.archive).toBe(9);
  });

  it("treats null n as zero", () => {
    expect(summarizeCounts([row({ n: null })])).toEqual(EMPTY);
  });
});
