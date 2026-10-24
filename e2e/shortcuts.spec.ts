import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import {
  createCollection,
  readSession,
  seedItems,
  startGuest,
  supabasePublicEnv,
  tagItems,
  type AppSession,
} from "./helpers/session";

const TITLES = ["One", "Two", "Three", "Four"];

async function seed(page: Page, context: Parameters<typeof readSession>[0]) {
  const session = await readSession(context);
  const items = await seedItems(
    session,
    TITLES.map((title, index) => ({ kind: "note", title, position: `a${index}` })),
  );
  await page.reload();
  await expect(page.locator("[data-item-id]")).toHaveCount(TITLES.length);
  return { session, items };
}

async function itemRow(session: AppSession, id: string) {
  const { url, publishableKey } = supabasePublicEnv();
  const response = await fetch(
    `${url}/rest/v1/items?id=eq.${id}&select=is_favorite,archived_at,deleted_at,collection_id`,
    { headers: { apikey: publishableKey, Authorization: `Bearer ${session.accessToken}` } },
  );
  return ((await response.json()) as Record<string, unknown>[])[0];
}

test.describe("keyboard shortcuts", () => {
  test("J / K / arrows move the cursor, Escape clears it", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    await page.keyboard.press("j");
    await expect(page.locator('[data-cursor="true"]')).toContainText("One");
    await page.keyboard.press("j");
    await expect(page.locator('[data-cursor="true"]')).toContainText("Two");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-cursor="true"]')).toContainText("Three");
    await page.keyboard.press("k");
    await page.keyboard.press("ArrowUp");
    await expect(page.locator('[data-cursor="true"]')).toContainText("One");
    await expect(page.locator('[data-cursor="true"]')).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-cursor="true"]')).toHaveCount(0);
    errors.assertNone();
  });

  test("Enter opens the drawer, F favorites, E archives, Backspace trashes", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const { session, items } = await seed(page, context);

    await page.keyboard.press("j");
    await page.keyboard.press("f");
    await expect.poll(async () => (await itemRow(session, items[0]!.id))?.is_favorite).toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/item=/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/item=/);

    await page.keyboard.press("j");
    await page.keyboard.press("e");
    await expect
      .poll(async () => (await itemRow(session, items[1]!.id))?.archived_at)
      .not.toBeNull();

    // Archiving moved the cursor on to the next card.
    await page.keyboard.press("Backspace");
    await expect
      .poll(async () => (await itemRow(session, items[2]!.id))?.deleted_at)
      .not.toBeNull();
  });

  test("M moves the target into a collection", async ({ page, context }) => {
    await startGuest(page);
    const { session, items } = await seed(page, context);
    const collectionId = await createCollection(session, "Reading");
    await page.reload();

    await page.keyboard.press("j");
    await page.keyboard.press("m");
    const dialog = page.getByRole("dialog", { name: /Move 1 item to/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("option", { name: "Reading" }).click();
    await expect
      .poll(async () => (await itemRow(session, items[0]!.id))?.collection_id)
      .toBe(collectionId);
  });

  test("T adds an existing tag and can create a new one", async ({ page, context }) => {
    await startGuest(page);
    const { session, items } = await seed(page, context);
    await tagItems(session, "Existing", [items[3]!.id]);
    await page.reload();

    await page.keyboard.press("j");
    await page.keyboard.press("t");
    const dialog = page.getByRole("dialog", { name: /Add a tag to 1 item/ });
    await dialog.getByPlaceholder("Find or create a tag").fill("Existing");
    await dialog.getByRole("option", { name: "Existing" }).click();
    await expect(dialog).toBeHidden();

    await page.keyboard.press("t");
    await dialog.getByPlaceholder("Find or create a tag").fill("Brand new");
    await dialog.getByRole("option", { name: "Create tag “Brand new”" }).click();
    await expect(page.getByRole("link", { name: /Brand new/ })).toBeVisible();
  });

  test("Space opens quick look; J moves it; Space and Escape close; Enter opens the drawer", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    await seed(page, context);

    await page.keyboard.press("j");
    await page.keyboard.press(" ");
    const dialog = page.getByRole("dialog", { name: "One" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("j");
    await expect(page.getByRole("dialog", { name: "Two" })).toBeVisible();
    await page.keyboard.press(" ");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.keyboard.press(" ");
    await expect(page.getByRole("dialog", { name: "Two" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.keyboard.press(" ");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/item=/);
  });

  test("G then F / A / I navigates; a stray key cancels the chord", async ({ page, context }) => {
    await startGuest(page);
    await seed(page, context);

    await page.keyboard.press("g");
    await page.keyboard.press("f");
    await expect(page).toHaveURL(/\/app\/favorites$/);
    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/\/app\/all$/);
    await page.keyboard.press("g");
    await page.keyboard.press("i");
    await expect(page).toHaveURL(/\/app$/);

    await page.keyboard.press("g");
    await page.keyboard.press("x");
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("keys are ignored while typing in a field", async ({ page, context }) => {
    await startGuest(page);
    await seed(page, context);

    await page.getByRole("button", { name: "Add" }).first().click();
    await page.getByRole("textbox").first().fill("j");
    await expect(page.locator('[data-cursor="true"]')).toHaveCount(0);
  });

  test("/ focuses the search field", async ({ page, context }) => {
    await startGuest(page);
    await seed(page, context);

    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Search" })).toBeFocused();
  });

  test("Cmd/Ctrl+K opens the palette and pressing it again closes it", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeHidden();
    errors.assertNone();
  });

  test("Cmd/Ctrl+V saves the clipboard text as a note", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await startGuest(page);
    await seed(page, context);

    await page.evaluate(() => navigator.clipboard.writeText("Pasted with the keyboard"));
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ControlOrMeta+v");
    await expect(page.locator("[data-item-id]").filter({ hasText: "Pasted with the keyboard" }))
      .toHaveCount(1);
  });
});
