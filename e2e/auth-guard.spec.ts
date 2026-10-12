import { expect, test } from "@playwright/test";

test.describe("auth guard", () => {
  test("signed-out /app redirects to /login with next", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  });

  test("signed-out nested /app route keeps the full next", async ({ page }) => {
    await page.goto("/app/c/abc?item=1");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fc%2Fabc%3Fitem%3D1$/);
  });

  test("landing page loads without a redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Save anything. Find it again.",
    );
  });
});
