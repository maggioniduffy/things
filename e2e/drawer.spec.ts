import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { createNotes, readSession, startGuest } from "./helpers/session";

function drawer(page: Page) {
  return page.getByRole("dialog", { name: /Drawer 1|Drawer 2|isn't available/ });
}

function tileTitles(page: Page) {
  return page.locator('[data-slot="item-tile"] > p:first-of-type');
}

/** The tile's full-card open button. */
function openButton(page: Page, title: string) {
  return page.getByRole("button", { name: `Open ${title}` });
}

test.describe("item drawer", () => {
  test("opens from a card through ?item=, survives a reload and closes with Esc", async ({
    page,
    context,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);
    await createNotes(await readSession(context), 2, "Drawer");
    await page.reload();
    await expect(tileTitles(page)).toHaveCount(2);

    await openButton(page, "Drawer 1").click();
    await expect(page).toHaveURL(/\/app\?item=[0-9a-f-]{36}$/);
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Drawer 1");
    await expect(page.getByRole("textbox", { name: "Note" })).toHaveValue(
      "Saved by e2e (Drawer 1)",
    );

    // The URL is the source of truth: a reload opens the same item.
    await page.reload();
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Drawer 1");

    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/app$/);

    consoleErrors.assertNone();
  });

  test("edits the title and the note and keeps them after a reload", async ({ page, context }) => {
    await startGuest(page);
    await createNotes(await readSession(context), 1, "Drawer");
    await page.reload();

    await openButton(page, "Drawer 1").click();
    const title = page.getByRole("textbox", { name: "Title" });
    await title.fill("Renamed note");
    await title.press("Enter");
    const note = page.getByRole("textbox", { name: "Note" });
    await note.fill("Edited text");
    await page.getByRole("textbox", { name: "Title" }).focus(); // blur the note

    await expect(page.getByRole("dialog", { name: "Renamed note" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/app$/);
    await expect(tileTitles(page)).toHaveText(["Renamed note"]);

    await page.reload();
    await openButton(page, "Renamed note").click();
    await expect(page.getByRole("textbox", { name: "Note" })).toHaveValue("Edited text");
  });

  test("moves an item to trash from the drawer and Undo brings it back", async ({
    page,
    context,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);
    await createNotes(await readSession(context), 2, "Drawer");
    await page.reload();
    await expect(tileTitles(page)).toHaveCount(2);

    await openButton(page, "Drawer 1").click();
    await expect(drawer(page)).toBeVisible();
    await page.getByRole("button", { name: "Move to trash" }).click();

    // The drawer closes, the card leaves the Inbox and the toast offers Undo.
    await expect(drawer(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/app$/);
    await expect(tileTitles(page)).toHaveText(["Drawer 2"]);
    const sidebar = page.getByRole("navigation", { name: "Sidebar" });
    await expect(
      sidebar.getByRole("link", { name: /^Trash/ }).locator('[data-slot="nav-count"]'),
    ).toHaveText("1");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(tileTitles(page)).toHaveText(["Drawer 1", "Drawer 2"]);
    await expect(sidebar.getByRole("link", { name: /^Trash/ })).not.toContainText("1");

    // The database agrees after a refetch.
    await page.reload();
    await expect(tileTitles(page)).toHaveText(["Drawer 1", "Drawer 2"]);
    consoleErrors.assertNone();
  });

  test("restores and deletes forever from the Trash view", async ({ page, context }) => {
    await startGuest(page);
    await createNotes(await readSession(context), 2, "Drawer");
    await page.reload();

    for (const title of ["Drawer 1", "Drawer 2"]) {
      await openButton(page, title).click();
      await page.getByRole("button", { name: "Move to trash" }).click();
      await expect(openButton(page, title)).toHaveCount(0);
    }
    await page.goto("/app/trash");
    await expect(tileTitles(page)).toHaveCount(2);

    await openButton(page, "Drawer 1").click();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(tileTitles(page)).toHaveText(["Drawer 2"]);

    await openButton(page, "Drawer 2").click();
    await page.getByRole("button", { name: "Delete forever" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete forever?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Trash is empty." })).toBeVisible();

    await page.goto("/app");
    await expect(tileTitles(page)).toHaveText(["Drawer 1"]);
  });

  test("an unknown item id shows an unavailable message instead of crashing", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);

    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      await page.goto(`/app?item=${id}`);
      await expect(drawer(page)).toBeVisible();
      await expect(page.getByText("This item isn't available")).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(page).toHaveURL(/\/app$/);
    }
    consoleErrors.assertNone();
  });
});
