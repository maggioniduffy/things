import { devices, type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { startGuest } from "./helpers/session";

// iOS Safari zooms the page when a focused text field computes below 16px. On touch devices every
// text-entry element must be >= 16px, also at widths past `sm` (landscape phones, iPads), where the
// per-field `sm:text-body` (15px) used to win. Desktop (fine pointer) keeps 15px.
// The project only has desktop chromium, so the iPhone 13 device (viewport, touch, UA) is set here.
const iPhone = { ...devices["iPhone 13"] } as Record<string, unknown>;
delete iPhone.defaultBrowserType;

const TEXT_ENTRY =
  "input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden]):not([type=range]):not([type=color]), textarea, select, [contenteditable]:not([contenteditable=false])";

async function expectTextEntrySizes(scope: Locator, minimum = 1) {
  const sizes = await scope.locator(TEXT_ENTRY).evaluateAll((nodes) =>
    nodes
      .filter((node) => (node as HTMLElement).getClientRects().length > 0)
      .map((node) => ({
        label: node.getAttribute("aria-label") ?? node.getAttribute("name") ?? node.tagName,
        size: parseFloat(getComputedStyle(node).fontSize),
      })),
  );
  expect(sizes.length).toBeGreaterThanOrEqual(minimum);
  for (const { label, size } of sizes) {
    expect(size, `font-size of "${label}"`).toBeGreaterThanOrEqual(16);
  }
}

async function noPageZoom(page: Page) {
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
}

async function visitScreens(page: Page) {
  await page.goto("/login");
  await expectTextEntrySizes(page.locator("body"));

  await startGuest(page);

  // Quick add on the board.
  await expectTextEntrySizes(page.locator("main"));

  // Search field.
  await expectTextEntrySizes(page.getByRole("searchbox", { name: "Search" }).locator(".."), 1);

  // Add sheet and the new-collection form.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expectTextEntrySizes(page.getByRole("dialog", { name: "Add" }));
  await page.keyboard.press("Escape");

  await noPageZoom(page);
}

test.describe("iPhone portrait", () => {
  test.use(iPhone);

  test("every text-entry element is at least 16px", async ({ page }) => {
    await visitScreens(page);
  });

  test("the sidebar form and the item drawer fields are at least 16px", async ({ page }) => {
    await startGuest(page);
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await page.getByRole("button", { name: "New collection" }).click();
    await expectTextEntrySizes(page.getByRole("dialog", { name: "New collection" }));
  });
});

test.describe("iPhone landscape (past the sm breakpoint)", () => {
  test.use({ ...iPhone, viewport: { width: 844, height: 390 } });

  test("every text-entry element is still at least 16px", async ({ page }) => {
    await visitScreens(page);
  });
});

test.describe("desktop", () => {
  test("the shared Input keeps its 15px size with a fine pointer", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator("input[type=email]").first();
    await expect(email).toBeVisible();
    const size = await email.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBe(15);
  });
});
