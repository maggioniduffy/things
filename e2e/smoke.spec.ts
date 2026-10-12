import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Things/);
  await expect(page.getByRole("heading", { level: 1, name: "Things" })).toBeVisible();
});
