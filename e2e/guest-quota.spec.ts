import { expect, test } from "./fixtures";
import { readSession, startGuest, uploadBytes } from "./helpers/session";

const MB = 1024 * 1024;

// Phase 1 gate: "a guest is blocked past 25 MB", exercised through the real Storage API.
test.describe("guest storage quota", () => {
  test("blocks a file over 10 MB and a total over 25 MB, but allows re-uploading the same file", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const session = await readSession(context);

    expect(await uploadBytes(session, "quota/too-big.bin", 11 * MB)).toBeGreaterThanOrEqual(400);

    expect(await uploadBytes(session, "quota/one.bin", 9 * MB)).toBe(200);
    expect(await uploadBytes(session, "quota/two.bin", 9 * MB)).toBe(200);

    // Replacing an existing file at 18 MB used must not count the old copy twice.
    expect(await uploadBytes(session, "quota/two.bin", 9 * MB, { upsert: true })).toBe(200);

    // A third 9 MB file would make 27 MB.
    expect(await uploadBytes(session, "quota/three.bin", 9 * MB)).toBeGreaterThanOrEqual(400);
  });

  test("parallel uploads cannot slip past the 25 MB total together", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);

    const statuses = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => uploadBytes(session, `parallel/${n}.bin`, 9 * MB)),
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(2);
  });
});
