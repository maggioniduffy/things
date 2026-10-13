import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { createCollection, readSession, seedItems, startGuest } from "./helpers/session";

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta"];

async function seed(page: Page, context: BrowserContext) {
  const session = await readSession(context);
  for (const [index, name] of NAMES.entries()) {
    await createCollection(session, name, null, `a${index}`);
  }
  await page.reload();
}

function collectionNames(page: Page) {
  return page.getByRole("list", { name: "Collections" }).locator("> li > a > span.truncate");
}

/** Counts PATCH requests to a table and returns a getter. */
function countPatches(page: Page, table: string) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes(`/rest/v1/${table}`)) {
      urls.push(request.url());
    }
  });
  return () => urls.length;
}

test.describe("sidebar reorder", () => {
  test("a pointer drag reorders collections with one update and persists", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await expect(collectionNames(page)).toHaveText(NAMES);

    const patches = countPatches(page, "collections");
    const items = page.getByRole("list", { name: "Collections" }).locator("> li");
    await items.nth(0).hover();
    const handle = page.getByRole("button", { name: "Drag to reorder collection Alpha" });
    const from = await handle.boundingBox();
    const to = await items.nth(2).boundingBox();
    if (!from || !to) throw new Error("No boxes to drag between.");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 4 });
    await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2 + 4, { steps: 12 });
    await page.mouse.up();

    await expect(collectionNames(page)).toHaveText(["Bravo", "Charlie", "Alpha", "Delta"]);
    await expect.poll(patches).toBe(1);
    // A row drag never navigates (it is not a click on the link).
    await expect(page).toHaveURL(/\/app$/);

    await page.reload();
    await expect(collectionNames(page)).toHaveText(["Bravo", "Charlie", "Alpha", "Delta"]);
    expect(patches()).toBe(1);
    errors.assertNone();
  });

  test("a keyboard reorder writes one row and persists", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    const patches = countPatches(page, "collections");
    const handle = page.getByRole("button", { name: "Drag to reorder collection Delta" });
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    // dnd-kit attaches its keyboard listeners a tick after the drag starts: repeat until announced.
    for (const [key, position] of [
      ["ArrowUp", 3],
      ["ArrowUp", 2],
    ] as const) {
      const moved = page.getByText(`collection Delta moved to position ${position} of 4.`);
      await expect(async () => {
        if (!(await moved.count())) await page.keyboard.press(key);
        await expect(moved).toBeAttached({ timeout: 500 });
      }).toPass();
    }
    await page.keyboard.press("Space");
    await expect(page.getByText("collection Delta dropped at position 2 of 4.")).toBeAttached();

    await expect(collectionNames(page)).toHaveText(["Alpha", "Delta", "Bravo", "Charlie"]);
    await expect.poll(patches).toBe(1);

    await page.reload();
    await expect(collectionNames(page)).toHaveText(["Alpha", "Delta", "Bravo", "Charlie"]);
    expect(patches()).toBe(1);
    errors.assertNone();
  });

  test("smart views reorder too, by keyboard", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    for (const name of ["First view", "Second view"]) {
      await page.getByRole("button", { name: "New smart view" }).click();
      const dialog = page.getByRole("dialog", { name: "New smart view" });
      await dialog.getByRole("textbox", { name: "Name" }).fill(name);
      await dialog.getByRole("button", { name: "Create" }).click();
      await expect(dialog).toBeHidden();
    }
    const names = page
      .getByRole("list", { name: "Smart views" })
      .locator("> li > a > span.truncate");
    await expect(names).toHaveText(["First view", "Second view"]);

    const patches = countPatches(page, "smart_views");
    const handle = page.getByRole("button", { name: "Drag to reorder smart view Second view" });
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    const moved = page.getByText("smart view Second view moved to position 1 of 2.");
    await expect(async () => {
      if (!(await moved.count())) await page.keyboard.press("ArrowUp");
      await expect(moved).toBeAttached({ timeout: 500 });
    }).toPass();
    await page.keyboard.press("Space");

    await expect(names).toHaveText(["Second view", "First view"]);
    await expect.poll(patches).toBe(1);
    await page.reload();
    await expect(names).toHaveText(["Second view", "First view"]);
    errors.assertNone();
  });

  test("a card can still be dropped on a sortable collection row", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    for (const [index, name] of NAMES.entries()) {
      await createCollection(session, name, null, `a${index}`);
    }
    await seedItems(session, [{ kind: "note", title: "Loose note", position: "a0" }]);
    await page.reload();

    const card = page.getByRole("button", { name: "Open Loose note" });
    const row = page.getByRole("link", { name: /^Bravo/ });
    await expect(card).toBeVisible();
    await expect(row).toBeVisible();
    const a = await card.boundingBox();
    const b = await row.boundingBox();
    if (!a || !b) throw new Error("No boxes to drag between.");
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
    await page.mouse.up();

    // The toast names the note, so look at the board, not at the text.
    await expect(page.locator("[data-item-id]")).toHaveCount(0);
    await page.getByRole("link", { name: /^Bravo/ }).click();
    await expect(page.locator('[data-slot="item-tile"] > p:first-of-type')).toHaveText([
      "Loose note",
    ]);
    errors.assertNone();
  });
});
