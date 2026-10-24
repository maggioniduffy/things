import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { createNotes, readSession, startGuest } from "./helpers/session";

test.describe("note color", () => {
  test("sets Graphite in the drawer, recolors the card and keeps it after a reload", async ({
    page,
    context,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);
    await createNotes(await readSession(context), 1, "Tinted");
    await page.reload();

    const tile = page.locator('[data-slot="item-tile"]').first();
    await expect(tile).toHaveClass(/bg-aurora-coral\/20/);

    await page.getByRole("button", { name: "Open Tinted 1" }).click();
    await page.getByRole("radio", { name: "Graphite" }).click();
    await expect(page.getByRole("radio", { name: "Graphite" })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(tile).toHaveClass(/bg-note-graphite/);
    await expect(tile).toHaveAttribute("data-inverse", "true");

    await page.reload();
    const reloaded = page.locator('[data-slot="item-tile"]').first();
    await expect(reloaded).toHaveClass(/bg-note-graphite/);
    // The title is still the card's first paragraph.
    await expect(reloaded.locator(":scope > p:first-of-type")).toHaveText("Tinted 1");

    consoleErrors.assertNone();
  });
});
