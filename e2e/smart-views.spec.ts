import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { readSession, seedItems, startGuest, tagItems } from "./helpers/session";

function tileTitles(page: Page) {
  return page.locator('[data-slot="item-tile"] > p:first-of-type');
}

function smartViewLink(page: Page, name: string | RegExp) {
  return page.getByRole("list", { name: "Smart views" }).getByRole("link", { name });
}

async function seed(page: Page, context: Parameters<typeof readSession>[0]) {
  const session = await readSession(context);
  const items = await seedItems(session, [
    { kind: "pdf", title: "Unread paper", file_name: "a.pdf", is_read: false },
    { kind: "pdf", title: "Read paper", file_name: "b.pdf", is_read: true },
    {
      kind: "pdf",
      title: "Archived paper",
      file_name: "c.pdf",
      archived_at: new Date().toISOString(),
    },
    { kind: "note", title: "Unread note", is_read: false },
    { kind: "note", title: "Tagged note", is_read: true },
    { kind: "note", title: "Doubly tagged note", is_read: true },
  ]);
  const byTitle = new Map(items.map((item) => [item.title, item.id]));
  await tagItems(session, "thesis", [
    byTitle.get("Tagged note")!,
    byTitle.get("Doubly tagged note")!,
  ]);
  await tagItems(session, "draft", [byTitle.get("Doubly tagged note")!]);
  await page.reload();
}

test.describe("smart views", () => {
  test("create, filter, edit, reload and delete", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    // Create "Unread PDFs" from the sidebar.
    await page.getByRole("button", { name: "New smart view" }).click();
    const dialog = page.getByRole("dialog", { name: "New smart view" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Unread PDFs");
    await dialog.getByRole("textbox", { name: /Emoji/ }).fill("📄");
    await dialog.getByText("PDFs", { exact: true }).click();
    await dialog.getByText("Unread", { exact: true }).click();
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(dialog).toBeHidden();

    const link = smartViewLink(page, /Unread PDFs/);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/app\/v\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "📄 Unread PDFs" })).toBeVisible();
    await expect(page.locator('[data-slot="rules-summary"]')).toHaveText("Kind: PDFs · Unread");

    // Only the matching item: not the read PDF, the archived PDF or the unread note.
    await expect(tileTitles(page)).toHaveText(["Unread paper"]);
    // A filter, not a place: no reorder handles on cards.
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(0);
    const viewUrl = page.url();

    // Edit the rules: read PDFs instead.
    await page.getByRole("button", { name: "Unread PDFs options" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit smart view" });
    await expect(edit.getByRole("textbox", { name: "Name" })).toHaveValue("Unread PDFs");
    await edit.getByRole("textbox", { name: "Name" }).fill("Read PDFs");
    await edit.getByText("Read", { exact: true }).click();
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();

    await expect(page.getByRole("heading", { level: 1, name: "📄 Read PDFs" })).toBeVisible();
    await expect(page.locator('[data-slot="rules-summary"]')).toHaveText("Kind: PDFs · Read");
    await expect(tileTitles(page)).toHaveText(["Read paper"]);

    // Persists after a reload (server prefetch + client).
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "📄 Read PDFs" })).toBeVisible();
    await expect(tileTitles(page)).toHaveText(["Read paper"]);
    await expect(smartViewLink(page, /Read PDFs/)).toBeVisible();

    // Tags match all: two tags leave only the doubly tagged note.
    await page.getByRole("button", { name: "Read PDFs options" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const tags = page.getByRole("dialog", { name: "Edit smart view" });
    await tags.getByText("PDFs", { exact: true }).click(); // clear the kind
    await tags.getByText("#thesis", { exact: true }).click();
    await tags.getByText("#draft", { exact: true }).click();
    await tags.getByRole("button", { name: "Save" }).click();
    await expect(tileTitles(page)).toHaveText(["Doubly tagged note"]);
    await page.reload();
    await expect(tileTitles(page)).toHaveText(["Doubly tagged note"]);

    // Deleting the open view lands on /app and leaves the items alone.
    await page.getByRole("button", { name: "Read PDFs options" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page
      .getByRole("dialog", { name: "Delete Read PDFs?" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("No smart views yet")).toBeVisible();
    await page.goto("/app/all");
    await expect(tileTitles(page)).toHaveCount(5);

    // The old link is gone.
    await page.goto(viewUrl);
    await expect(page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
    errors.assertNone();
  });

  test("a view with no match shows the empty state", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await page.getByRole("button", { name: "New smart view" }).click();
    const dialog = page.getByRole("dialog", { name: "New smart view" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Old stuff");
    await dialog.getByRole("textbox", { name: "Contains text" }).fill("zzzznomatch");
    await dialog.getByRole("button", { name: "Create" }).click();
    await smartViewLink(page, "Old stuff").click();
    await expect(page.getByRole("heading", { name: "Nothing matches yet." })).toBeVisible();
    errors.assertNone();
  });

  test("text, favorite and recency rules filter", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    await seedItems(session, [
      { kind: "note", title: "Canción favorita", is_favorite: true },
      { kind: "note", title: "Canción olvidada" },
      { kind: "note", title: "Other favorite", is_favorite: true },
    ]);
    await page.reload();
    await page.getByRole("button", { name: "New smart view" }).click();
    const dialog = page.getByRole("dialog", { name: "New smart view" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Songs I love");
    await dialog.getByText("Favorites", { exact: true }).click();
    await dialog.getByRole("spinbutton").fill("3");
    await dialog.getByRole("textbox", { name: "Contains text" }).fill("cancion");
    await dialog.getByRole("button", { name: "Create" }).click();
    await smartViewLink(page, "Songs I love").click();
    await expect(tileTitles(page)).toHaveText(["Canción favorita"]);
    errors.assertNone();
  });
});
