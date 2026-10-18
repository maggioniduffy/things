import { describe, expect, it } from "vitest";
import { moveRow } from "@/lib/order";
import { makeItem } from "@/test/fixtures";
import { flatDropIndex, groupByCollection, visibleItemIds } from "./group";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const item = (id: string, collection_id: string | null) => makeItem({ id, collection_id });

describe("groupByCollection", () => {
  it("keeps loose items and puts a folder where its first item is", () => {
    const entries = groupByCollection(
      [item("1", null), item("2", A), item("3", null), item("4", A), item("5", B)],
      new Set(),
    );
    expect(
      entries.map((e) => (e.type === "item" ? e.item.id : `${e.collectionId}:${e.items.length}`)),
    ).toEqual(["1", `${A}:2`, "3", `${B}:1`]);
  });

  it("keeps the sort order inside a folder and reports expanded", () => {
    const entries = groupByCollection([item("1", A), item("2", B), item("3", A)], new Set([A]));
    const folder = entries[0];
    expect(folder).toMatchObject({ type: "folder", collectionId: A, expanded: true });
    expect(folder?.type === "folder" && folder.items.map((i) => i.id)).toEqual(["1", "3"]);
    expect(entries[1]).toMatchObject({ expanded: false });
  });

  it("lists visible ids: loose items and open folders only", () => {
    const entries = groupByCollection(
      [item("1", A), item("2", null), item("3", B), item("4", A)],
      new Set([A]),
    );
    expect(visibleItemIds(entries)).toEqual(["1", "4", "2"]);
  });
});

describe("flatDropIndex", () => {
  const flat = [item("L1", null), item("A1", A), item("L2", null), item("A2", A), item("L3", null)];
  const open = new Set([A]);
  const apply = (from: string, over: string) => {
    const target = flatDropIndex(flat, open, from, over);
    if (target === null) return null;
    const ids = flat.map((i) => i.id);
    const next = moveRow(ids, ids.indexOf(from), target);
    return visibleItemIds(
      groupByCollection(
        next.map((id) => flat.find((i) => i.id === id)!),
        open,
      ),
    );
  };

  it("moves a loose card to exactly where it was dropped", () => {
    // Screen: L1, A1, A2, L2, L3. L3 onto L1 -> L3 first.
    expect(apply("L3", "L1")).toEqual(["L3", "L1", "A1", "A2", "L2"]);
    // L2 onto L3.
    expect(apply("L2", "L3")).toEqual(["L1", "A1", "A2", "L3", "L2"]);
  });

  it("reorders inside an open folder, accepting that the folder may shift", () => {
    const result = apply("A1", "A2");
    expect(result).not.toBeNull();
    const folder = result!.filter((id) => id.startsWith("A"));
    expect(folder).toEqual(["A2", "A1"]);
  });

  it("does nothing for a loose card dropped inside a folder", () => {
    expect(flatDropIndex(flat, open, "L3", "A2")).toBeNull();
  });

  it("does nothing for a folder card dropped outside its folder", () => {
    expect(flatDropIndex(flat, open, "A2", "L2")).toBeNull();
  });

  it("does nothing for an unknown card or a drop on itself", () => {
    expect(flatDropIndex(flat, open, "A2", "A2")).toBeNull();
    expect(flatDropIndex(flat, open, "A2", "nope")).toBeNull();
  });
});
