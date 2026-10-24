import { expect, test } from "./fixtures";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Thingteca/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
