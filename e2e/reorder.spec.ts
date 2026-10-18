import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { readSession, seedItems, startGuest } from "./helpers/session";

const TITLES = ["Alpha", "Bravo", "Charlie", "Delta"];

async function seed(page: Page, context: Parameters<typeof readSession>[0]) {
  const session = await readSession(context);
  await seedItems(
    session,
    TITLES.map((title, index) => ({ kind: "note", title, position: `a${index}` })),
  );
  await page.reload();
  await expect(page.locator("[data-item-id]")).toHaveCount(TITLES.length);
}

function tileTitles(page: Page) {
  return page.locator('[data-slot="item-tile"] > p:first-of-type');
}

function rowTitles(page: Page) {
  return page.locator('[data-slot="item-row"] > span.truncate');
}

/** Counts PATCH requests to items and returns a getter. */
function countItemPatches(page: Page) {
  let count = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/rest/v1/items")) count += 1;
  });
  return () => count;
}

/**
 * Space, arrows, Space on a card's handle. dnd-kit attaches its keyboard listeners a tick after
 * the drag starts, so an arrow pressed too early is ignored: each step repeats until announced.
 */
async function keyboardMove(page: Page, title: string, steps: [key: string, position: number][]) {
  const handle = page.getByRole("button", { name: `Reorder ${title}` });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  for (const [key, position] of steps) {
    const moved = page.getByText(`${title} moved to position ${position} of 4.`);
    await expect(async () => {
      if (!(await moved.count())) await page.keyboard.press(key);
      await expect(moved).toBeAttached({ timeout: 500 });
    }).toPass();
  }
  const final = steps[steps.length - 1]![1];
  await page.keyboard.press("Space");
  await expect(page.getByText(`${title} dropped at position ${final} of 4.`)).toBeAttached();
}

test.describe("manual reorder", () => {
  test("keyboard reorder in the grid writes one row and persists", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await expect(tileTitles(page)).toHaveText(TITLES);

    const patches = countItemPatches(page);
    await keyboardMove(page, "Alpha", [
      ["ArrowRight", 2],
      ["ArrowRight", 3],
    ]);

    await expect(tileTitles(page)).toHaveText(["Bravo", "Charlie", "Alpha", "Delta"]);
    await expect.poll(patches).toBe(1);

    await page.reload();
    await expect(tileTitles(page)).toHaveText(["Bravo", "Charlie", "Alpha", "Delta"]);
    expect(patches()).toBe(1);
    errors.assertNone();
  });

  test("keyboard reorder in the list view persists", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await page.getByRole("button", { name: "List view" }).click();
    await expect(rowTitles(page)).toHaveText(TITLES);

    const patches = countItemPatches(page);
    await keyboardMove(page, "Delta", [
      ["ArrowUp", 3],
      ["ArrowUp", 2],
    ]);

    await expect(rowTitles(page)).toHaveText(["Alpha", "Delta", "Bravo", "Charlie"]);
    await expect.poll(patches).toBe(1);

    await page.reload();
    await expect(rowTitles(page)).toHaveText(["Alpha", "Delta", "Bravo", "Charlie"]);
    errors.assertNone();
  });

  test("a pointer drag reorders without opening the drawer, a click still opens it", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    const patches = countItemPatches(page);
    const from = await page.locator("[data-item-id]").nth(0).boundingBox();
    const to = await page.locator("[data-item-id]").nth(2).boundingBox();
    if (!from || !to) throw new Error("No card boxes.");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2 + 20, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();

    await expect.poll(patches).toBe(1);
    await expect(tileTitles(page)).not.toHaveText(TITLES);
    expect((await tileTitles(page).allTextContents())[0]).toBe("Bravo");
    await expect(page).not.toHaveURL(/item=/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Open Delta" }).click();
    await expect(page).toHaveURL(/item=/);
    errors.assertNone();
  });

  test("no handles outside manual sort", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(4);

    await page.goto("/app?sort=newest");
    await expect(tileTitles(page)).toHaveCount(4);
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(0);
    errors.assertNone();
  });
});
