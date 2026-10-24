import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { startGuest } from "./helpers/session";

// WP 9.2: on a phone the Add form is a compact bottom sheet, not a full-screen dialog.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("Add opens a compact bottom sheet and Enter saves a note", async ({ page }) => {
  trackConsoleErrors(page);
  await startGuest(page);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add" });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThan(844 * 0.6);

  const field = sheet.getByRole("textbox", { name: "Link or note" });
  await field.fill("A phone note");
  await field.press("Enter");
  await expect(sheet).toBeHidden();
  await expect(page.getByText("A phone note").first()).toBeVisible();
});
