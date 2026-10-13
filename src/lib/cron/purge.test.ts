// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fakeAdmin, newFakeState, type FakeItem } from "./fake-admin";
import { purgeTrash, purgeUnfurlLog } from "./purge";

const NOW = new Date("2026-10-13T04:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const U = "11111111-1111-4111-8111-111111111111";
let counter = 0;
function item(deletedDaysAgo: number | null, files = true): FakeItem {
  const id = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  return {
    id,
    file_path: files ? `${U}/${id}/a.pdf` : null,
    thumbnail_path: files ? `${U}/${id}/.thumb.webp` : null,
    deleted_at: deletedDaysAgo === null ? null : daysAgo(deletedDaysAgo),
  };
}

function withObjects(state: ReturnType<typeof newFakeState>) {
  for (const row of state.items) {
    for (const path of [row.file_path, row.thumbnail_path]) {
      if (path) state.objects.set(path, daysAgo(60));
    }
  }
}

describe("purgeTrash", () => {
  it("purges only items trashed more than 30 days ago", async () => {
    const state = newFakeState();
    const old = item(31);
    const recent = item(29);
    const live = item(null);
    state.items.push(old, recent, live);
    withObjects(state);

    const result = await purgeTrash(fakeAdmin(state), NOW);

    expect(result).toEqual({ purgedItems: 1, removedObjects: 2 });
    expect(state.items.map((row) => row.id)).toEqual([recent.id, live.id]);
    expect([...state.objects.keys()].sort()).toEqual(
      [recent.file_path, recent.thumbnail_path, live.file_path, live.thumbnail_path].sort(),
    );
  });

  it("removes storage objects before deleting rows", async () => {
    const state = newFakeState();
    state.items.push(item(40));
    withObjects(state);

    await purgeTrash(fakeAdmin(state), NOW);

    expect(state.calls).toEqual(["storage.remove", "items.delete"]);
  });

  it("deletes rows without files and skips the storage call", async () => {
    const state = newFakeState();
    state.items.push(item(40, false));

    const result = await purgeTrash(fakeAdmin(state), NOW);

    expect(result).toEqual({ purgedItems: 1, removedObjects: 0 });
    expect(state.calls).toEqual(["items.delete"]);
  });

  it("keeps rows whose storage removal fails, and still purges the others", async () => {
    const state = newFakeState();
    const bad = item(40);
    const good = item(40);
    state.items.push(bad, good);
    withObjects(state);
    state.failRemove = (paths) => paths.some((path) => path.includes(bad.id));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await purgeTrash(fakeAdmin(state), NOW);

    expect(result.purgedItems).toBe(1);
    expect(state.items.map((row) => row.id)).toEqual([bad.id]);
    expect(state.objects.has(bad.file_path!)).toBe(true);
    expect(state.objects.has(good.file_path!)).toBe(false);
  });

  it("deletes no rows when every storage call fails", async () => {
    const state = newFakeState();
    state.items.push(item(40), item(41));
    withObjects(state);
    state.failRemove = () => true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await purgeTrash(fakeAdmin(state), NOW);

    expect(result).toEqual({ purgedItems: 0, removedObjects: 0 });
    expect(state.items).toHaveLength(2);
    expect(state.calls).not.toContain("items.delete");
  });

  it("works through more than one batch", async () => {
    const state = newFakeState();
    for (let i = 0; i < 230; i++) state.items.push(item(45, false));
    state.items.push(item(1));

    const result = await purgeTrash(fakeAdmin(state), NOW);

    expect(result.purgedItems).toBe(230);
    expect(state.items).toHaveLength(1);
  });
});

describe("purgeUnfurlLog", () => {
  it("deletes rows older than 24 hours and reports the count", async () => {
    const state = newFakeState();
    state.unfurl.push(
      { created_at: new Date(NOW.getTime() - 25 * 3_600_000).toISOString() },
      { created_at: new Date(NOW.getTime() - 48 * 3_600_000).toISOString() },
      { created_at: new Date(NOW.getTime() - 23 * 3_600_000).toISOString() },
    );

    expect(await purgeUnfurlLog(fakeAdmin(state), NOW)).toBe(2);
    expect(state.unfurl).toHaveLength(1);
  });
});
