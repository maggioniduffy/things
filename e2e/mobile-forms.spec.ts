import { devices, type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { startGuest } from "./helpers/session";

// WP 10.4: on a phone every form is a bottom sheet, and focusing a field never zooms the page.
// The project only has desktop chromium, so the iPhone 13 device (viewport, touch, UA) is set here.
const iPhone = { ...devices["iPhone 13"] } as Record<string, unknown>;
delete iPhone.defaultBrowserType;
test.use(iPhone);

async function expectSheetWithoutZoom(page: Page, sheet: Locator) {
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-vaul-drawer-direction", "bottom");

  const fields = sheet.locator(
    "input:not([type=radio]):not([type=checkbox]):not([hidden]), textarea",
  );
  const count = await fields.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    await field.focus();
    const size = await field.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
    await field.blur();
  }
  const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  expect(scale).toBe(1);
}

test("Add and the sidebar forms open as sheets with 16px fields and no zoom", async ({ page }) => {
  await startGuest(page);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add" });
  await expectSheetWithoutZoom(page, add);
  await page.keyboard.press("Escape");
  await expect(add).toBeHidden();

  // The sidebar lives in a menu sheet on phones.
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "New collection" }).click();
  const collection = page.getByRole("dialog", { name: "New collection" });
  await expectSheetWithoutZoom(page, collection);
});
