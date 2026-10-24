import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { readSession, seedItems, startGuest, uploadBytes } from "./helpers/session";

const MB = 1024 * 1024;

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  return dialog;
}

// WP 7.2: the command palette finds items, runs actions and jumps to views; a guest can reach
// "Add email" from it and from the quota toast.
test.describe("command palette", () => {
  test("typing a title and pressing Enter opens that item's drawer", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const [note] = await seedItems(session, [{ kind: "note", title: "Canción de cuna" }]);
    await page.reload();

    const dialog = await openPalette(page);
    await page.keyboard.type("cancion");
    await expect(dialog.getByRole("option", { name: /Canción de cuna/ })).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`item=${note?.id}`));
    errors.assertNone();
  });

  test("Go to jumps to a view", async ({ page }) => {
    await startGuest(page);
    const dialog = await openPalette(page);
    await dialog.getByRole("option", { name: /^Favorites/ }).click();
    await expect(page).toHaveURL(/\/app\/favorites$/);
    await expect(dialog).toBeHidden();
  });

  test("Add item opens quick add", async ({ page }) => {
    await startGuest(page);
    const dialog = await openPalette(page);
    await dialog.getByRole("option", { name: "Add item" }).click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
  });

  test("a guest reaches Add email from the palette", async ({ page }) => {
    await startGuest(page);
    const dialog = await openPalette(page);
    await dialog.getByRole("option", { name: "Add email" }).click();
    await expect(page.getByRole("dialog", { name: "Keep your things" })).toBeVisible();
  });

  test("the guest-quota toast offers Add email, which opens the upgrade dialog", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const session = await readSession(context);
    expect(await uploadBytes(session, "quota/one.bin", 9 * MB)).toBe(200);
    expect(await uploadBytes(session, "quota/two.bin", 9 * MB)).toBe(200);

    // A third 9 MB file would make 27 MB: paste it like a screenshot would arrive.
    await page.evaluate((bytes) => {
      const data = new DataTransfer();
      data.items.add(
        new File([new Uint8Array(bytes)], "big.bin", { type: "application/octet-stream" }),
      );
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, 9 * MB);

    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "25 MB" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Add email" }).click();
    await expect(page.getByRole("dialog", { name: "Keep your things" })).toBeVisible();
  });
});
