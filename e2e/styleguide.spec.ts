import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";

const SECTIONS = ["Colors", "Typography", "Radii, shadows and motion", "Brand", "Components"];

test.describe("styleguide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/styleguide");
  });

  test("renders every section without console errors", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.reload();
    for (const name of SECTIONS) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
    await expect(page.getByRole("navigation", { name: "Styleguide sections" })).toBeVisible();
    consoleErrors.assertNone();
  });

  test("lists resolved token values", async ({ page }) => {
    await expect(page.getByText("--color-paper", { exact: true })).toBeVisible();
    await expect(page.getByText("#f3f4f6", { exact: true }).first()).toBeVisible();
  });

  test("dialog opens and closes on Escape", async ({ page }) => {
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Rename collection" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("undo toast shows an Undo button", async ({ page }) => {
    await page.getByRole("button", { name: "Show undo toast" }).click();
    await expect(page.getByText("Moved to trash")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  });

  test("dropdown menu opens on click and is keyboard navigable", async ({ page }) => {
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Rename" })).toHaveAttribute(
      "data-highlighted",
      "",
    );
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "data-highlighted",
      "",
    );
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("context menu opens on right click", async ({ page }) => {
    await page.getByText("Right-click here").click({ button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Rename" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("drawer opens and closes", async ({ page }) => {
    await page.getByRole("button", { name: "Open drawer" }).click();
    const drawer = page.getByRole("dialog", { name: "Item details" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Close drawer" }).click();
    await expect(drawer).toBeHidden();
  });

  test("inline command filters its items as you type", async ({ page }) => {
    const command = page.getByLabel("Command palette demo");
    await expect(command.getByRole("option")).toHaveCount(4);
    await command.getByPlaceholder("Type a command…").fill("note");
    await expect(command.getByRole("option")).toHaveCount(1);
    await expect(command.getByRole("option", { name: /Add note/ })).toBeVisible();
    await command.getByPlaceholder("Type a command…").fill("zzz");
    await expect(command.getByText("No results.")).toBeVisible();
  });
});
