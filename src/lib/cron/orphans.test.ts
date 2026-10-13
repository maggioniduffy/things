// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fakeAdmin, newFakeState } from "./fake-admin";
import { sweepOrphans } from "./orphans";

const NOW = new Date("2026-10-13T04:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const USER = "11111111-1111-4111-8111-111111111111";
const ORPHAN = "22222222-2222-4222-8222-222222222222";
const KEPT = "33333333-3333-4333-8333-333333333333";
const YOUNG = "44444444-4444-4444-8444-444444444444";

function seed() {
  const state = newFakeState();
  state.items.push({ id: KEPT, file_path: null, thumbnail_path: null, deleted_at: null });
  return state;
}

describe("sweepOrphans", () => {
  it("removes old objects of folders without an items row", async () => {
    const state = seed();
    state.objects.set(`${USER}/${ORPHAN}/a.png`, hoursAgo(48));
    state.objects.set(`${USER}/${ORPHAN}/.thumb.webp`, hoursAgo(48));

    expect(await sweepOrphans(fakeAdmin(state), NOW)).toBe(2);
    expect(state.objects.size).toBe(0);
  });

  it("keeps folders that have an items row (including trashed ones)", async () => {
    const state = seed();
    state.items.push({
      id: ORPHAN,
      file_path: null,
      thumbnail_path: null,
      deleted_at: hoursAgo(1),
    });
    state.objects.set(`${USER}/${KEPT}/a.png`, hoursAgo(500));
    state.objects.set(`${USER}/${ORPHAN}/a.png`, hoursAgo(500));

    expect(await sweepOrphans(fakeAdmin(state), NOW)).toBe(0);
    expect(state.objects.size).toBe(2);
  });

  it("skips folders younger than a day, even if only one object is young", async () => {
    const state = seed();
    state.objects.set(`${USER}/${YOUNG}/a.png`, hoursAgo(2));
    state.objects.set(`${USER}/${ORPHAN}/a.png`, hoursAgo(72));
    state.objects.set(`${USER}/${ORPHAN}/.thumb.webp`, hoursAgo(3));

    expect(await sweepOrphans(fakeAdmin(state), NOW)).toBe(0);
    expect(state.objects.size).toBe(3);
  });

  it("only removes the orphans when real and orphaned folders are mixed", async () => {
    const state = seed();
    state.objects.set(`${USER}/${KEPT}/a.png`, hoursAgo(500));
    state.objects.set(`${USER}/${ORPHAN}/a.png`, hoursAgo(500));

    expect(await sweepOrphans(fakeAdmin(state), NOW)).toBe(1);
    expect([...state.objects.keys()]).toEqual([`${USER}/${KEPT}/a.png`]);
  });

  it("ignores folders whose names are not UUIDs", async () => {
    const state = seed();
    state.objects.set(`not-a-user/${ORPHAN}/a.png`, hoursAgo(500));
    state.objects.set(`${USER}/not-an-item/a.png`, hoursAgo(500));

    expect(await sweepOrphans(fakeAdmin(state), NOW)).toBe(0);
    expect(state.objects.size).toBe(2);
  });

  it("does not remove anything when the storage call fails", async () => {
    const state = seed();
    state.objects.set(`${USER}/${ORPHAN}/a.png`, hoursAgo(500));
    state.failRemove = () => true;
    const errors = console.error;
    console.error = () => {};
    try {
      expect(await sweepOrphans(fakeAdmin(state), NOW)).toBe(0);
    } finally {
      console.error = errors;
    }
    expect(state.objects.size).toBe(1);
  });

  it("stops at the per-run object budget", async () => {
    const state = seed();
    for (let i = 0; i < 1200; i++) {
      const folder = `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
      state.objects.set(`${USER}/${folder}/a.png`, hoursAgo(500));
    }

    const removed = await sweepOrphans(fakeAdmin(state), NOW);

    expect(removed).toBe(1000);
    expect(state.objects.size).toBe(200);
  });
});
