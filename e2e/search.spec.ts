import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { readSession, seedItems, startGuest } from "./helpers/session";

const CARD = "[data-item-id]";

async function seedNotes(page: Page, context: Parameters<typeof readSession>[0]) {
  const session = await readSession(context);
  await seedItems(session, [
    { kind: "note", title: "Canción de cuna" },
    { kind: "note", title: "Receta de pan" },
  ]);
  await page.reload();
  await expect(page.locator(CARD)).toHaveCount(2);
  return session;
}

function searchBox(page: Page) {
  return page.getByRole("searchbox", { name: "Search" });
}

test.describe("board search", () => {
  test("typing finds accented titles without the accent", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seedNotes(page, context);

    await searchBox(page).fill("cancion");
    await expect(page).toHaveURL(/[?&]q=cancion/);
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText("Canción de cuna");
    errors.assertNone();
  });

  test("tolerates a typo", async ({ page, context }) => {
    await startGuest(page);
    await seedNotes(page, context);

    await searchBox(page).fill("cancoin");
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText("Canción de cuna");
  });

  test("a kind chip persists across a reload", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    await seedItems(session, [
      { kind: "note", title: "Receta de pan" },
      {
        kind: "link",
        title: "Pan casero",
        url: "https://example.com/pan",
        domain: "example.com",
        enrich_status: "done",
      },
    ]);
    await page.reload();
    await expect(page.locator(CARD)).toHaveCount(2);

    await searchBox(page).fill("pan");
    await expect(page.locator(CARD)).toHaveCount(2);
    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "Kind" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Notes" }).click();
    await expect(page).toHaveURL(/kind=note/);
    await expect(page.locator(CARD)).toHaveCount(1);

    await page.reload();
    await expect(page).toHaveURL(/kind=note/);
    await expect(page.getByRole("button", { name: "Remove filter: Notes" })).toBeVisible();
    await expect(searchBox(page)).toHaveValue("pan");
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText("Receta de pan");
  });

  test("searching inside Archive only shows archived things", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    await seedItems(session, [
      { kind: "note", title: "Canción de cuna" },
      { kind: "note", title: "Canción vieja", archived_at: new Date().toISOString() },
    ]);
    await page.goto("/app/archive");
    await expect(page.locator(CARD)).toHaveCount(1);

    await searchBox(page).fill("cancion");
    await expect(page).toHaveURL(/\/app\/archive\?.*q=cancion/);
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText("Canción vieja");
  });

  test("shows No matches with a way out", async ({ page, context }) => {
    await startGuest(page);
    await seedNotes(page, context);

    await searchBox(page).fill("zzzzqqqq");
    await expect(page.getByRole("heading", { name: "No matches" })).toBeVisible();
    await page
      .locator('[data-slot="no-matches"]')
      .getByRole("button", { name: "Clear search" })
      .click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.locator(CARD)).toHaveCount(2);
  });

  test("Escape clears the search and leaves the field", async ({ page, context }) => {
    await startGuest(page);
    await seedNotes(page, context);

    await searchBox(page).fill("pan");
    await expect(page.locator(CARD)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(searchBox(page)).toHaveValue("");
    await expect(searchBox(page)).not.toBeFocused();
    await expect(page.locator(CARD)).toHaveCount(2);
  });
});
