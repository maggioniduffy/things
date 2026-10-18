import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { createCollection, readSession, seedItems, startGuest } from "./helpers/session";

function tileTitles(page: Page) {
  return page.locator('[data-slot="item-tile"] > p:first-of-type');
}

test.describe("collection folders in All", () => {
  test("closed folders open inline, collapse again and are remembered after a reload", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const reading = await createCollection(session, "Reading");
    const recipes = await createCollection(session, "Recipes");
    await seedItems(session, [
      { kind: "note", title: "Loose note" },
      { kind: "note", title: "Read one", collection_id: reading },
      { kind: "note", title: "Read two", collection_id: reading },
      { kind: "note", title: "Soup", collection_id: recipes },
    ]);

    await page.goto("/app/all");
    // Closed: two folders and the loose card.
    await expect(page.locator('[data-slot="collection-folder"]')).toHaveCount(2);
    await expect(tileTitles(page)).toHaveText(["Loose note"]);
    const folder = page.getByRole("button", { name: "Open folder Reading" });
    await expect(folder).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("2 items")).toBeVisible();

    // Open one: its cards appear inline.
    await folder.click();
    await expect(page.getByRole("button", { name: "Collapse folder Reading" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(tileTitles(page)).toHaveText(["Loose note", "Read one", "Read two"]);
    await expect(page.getByRole("button", { name: "Open folder Recipes" })).toBeVisible();

    // A card still opens the drawer.
    await page.getByRole("button", { name: "Open Read one" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // The open state survives a reload.
    await page.reload();
    await expect(tileTitles(page)).toHaveText(["Loose note", "Read one", "Read two"]);

    // Collapse gathers the cards back.
    await page.getByRole("button", { name: "Collapse folder Reading" }).click();
    await expect(page.getByRole("button", { name: "Open folder Reading" })).toBeVisible();
    await expect(tileTitles(page)).toHaveText(["Loose note"]);
    await page.reload();
    await expect(page.getByRole("button", { name: "Open folder Reading" })).toBeVisible();
    await expect(page.locator('[data-slot="collection-folder"]')).toHaveCount(2);

    // The secondary link goes to the collection.
    await page
      .locator('[data-slot="collection-folder"]', { hasText: "Recipes" })
      .getByRole("link", { name: "Open collection" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/app/c/${recipes}$`));
    errors.assertNone();
  });
});
