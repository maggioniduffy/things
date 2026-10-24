import { expect, test, type Page } from "@playwright/test";
import { TOUR_WELCOME } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { guestBanner } from "./helpers/session";

// Not startGuest: it waits for the guest banner, which the tour's modal hides from the a11y tree.
async function enterAsGuest(page: Page) {
  await page.goto("/");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Try without an account" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app$/);
}

const tour = (page: Page) => page.getByRole("dialog", { name: TOUR_WELCOME });

test.describe("onboarding tour", () => {
  test("shows once for a new guest; Skip keeps it closed after a reload", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await enterAsGuest(page);

    await expect(tour(page)).toBeVisible();
    await expect(tour(page).getByRole("list", { name: "Step 1 of 6" })).toBeVisible();
    await tour(page).getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.reload();
    await expect(guestBanner(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    errors.assertNone();
  });

  test("Next, Back and Finish walk the steps; Finish keeps it closed after a reload", async ({
    page,
  }) => {
    await enterAsGuest(page);
    const dialog = page.getByRole("dialog");
    await expect(tour(page)).toBeVisible();

    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByRole("list", { name: "Step 2 of 6" })).toBeVisible();
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog.getByRole("list", { name: "Step 1 of 6" })).toBeVisible();

    for (let step = 2; step <= 6; step++) {
      await dialog.getByRole("button", { name: "Next" }).click();
      await expect(dialog.getByRole("list", { name: `Step ${step} of 6` })).toBeVisible();
    }
    // The guest-only last step offers the email upgrade and has no Skip.
    await expect(dialog.getByRole("button", { name: "Add email" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Skip" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Finish" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(guestBanner(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("replays from the palette and the sidebar", async ({ page }) => {
    await enterAsGuest(page);
    await tour(page).getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog");
    await palette.getByRole("combobox").fill("show the tour");
    await palette.getByRole("option", { name: "Show the tour" }).click();
    await expect(tour(page)).toBeVisible();
    await tour(page).getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "Show the tour" }).click();
    await expect(tour(page)).toBeVisible();
    await tour(page).getByRole("button", { name: "Skip" }).click();

    // A replay never writes; the account stays done after a reload.
    await page.reload();
    await expect(guestBanner(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
