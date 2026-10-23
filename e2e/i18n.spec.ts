import { expect, test } from "@playwright/test";

test.describe("language", () => {
  test.use({ extraHTTPHeaders: { "accept-language": "es-AR" } });

  test("follows Accept-Language, switches via the footer and persists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page).toHaveTitle(/^Cosateca — /);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Guardá lo que quieras");

    const switcher = page.getByRole("contentinfo").getByRole("group", { name: "Idioma" });
    await switcher.getByRole("button", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Thingteca — save anything for later");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Save anything. Find it again.",
    );

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Thingteca — save anything for later");
  });
});
