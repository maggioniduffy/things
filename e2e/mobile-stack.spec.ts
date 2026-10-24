import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { createNotes, readSession, startGuest } from "./helpers/session";

// WP 9.3: on a phone the board cards pile up like a deck; on desktop the grid is untouched.

const firstCard = (page: import("@playwright/test").Page) =>
  page.locator('[data-view-mode="grid"] > li').first().locator("[data-stack-card]");

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the first card stays stuck in view after scrolling past several cards", async ({
    page,
    context,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);
    await createNotes(await readSession(context), 8, "Stacked");
    await page.reload();

    const card = firstCard(page);
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("position", "sticky");

    await page.locator("main").evaluate((main) => main.scrollBy(0, 900));
    await expect.poll(async () => (await card.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
    const box = await card.boundingBox();
    expect(box!.y).toBeLessThan(200);
    expect(box!.y + box!.height).toBeGreaterThan(0);

    // The last card can still be scrolled fully into view.
    await page.locator("main").evaluate((main) => main.scrollTo(0, main.scrollHeight));
    await expect(page.getByRole("button", { name: "Open Stacked 8" })).toBeInViewport({
      ratio: 1,
    });
    // No blank screen after the last card: the scroll ends where the grid ends.
    const gap = await page.locator("main").evaluate((main) => {
      const grid = main.querySelector('[data-view-mode="grid"]')!.getBoundingClientRect();
      return main.getBoundingClientRect().bottom - grid.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(160);

    consoleErrors.assertNone();
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("cards are not sticky", async ({ page, context }) => {
    await startGuest(page);
    await createNotes(await readSession(context), 3, "Plain");
    await page.reload();
    await expect(firstCard(page)).toHaveCSS("position", "static");
  });
});
