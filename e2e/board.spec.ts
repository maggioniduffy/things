import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import {
  accountGroup,
  createCollection,
  createNotes,
  readSession,
  seedItems,
  startGuest,
  tagItems,
} from "./helpers/session";

const MARKER = "__marker";

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Sidebar" });
}

/** A sidebar link by its label (the count is part of the link's text, so match the start). */
function navLink(page: Page, label: string) {
  return sidebar(page).getByRole("link", { name: new RegExp(`^${label}(\\s|$)`) });
}

async function expectCount(page: Page, label: string, count: number) {
  await expect(navLink(page, label).locator('[data-slot="nav-count"]')).toHaveText(String(count));
}

/** Titles of the placeholder tiles, in DOM order. */
function tileTitles(page: Page) {
  return page.locator('[data-slot="item-tile"] > p:first-of-type');
}

async function setMarker(page: Page) {
  await page.evaluate((key) => {
    (window as unknown as Record<string, number>)[key] = 1;
  }, MARKER);
}

async function readMarker(page: Page) {
  return page.evaluate((key) => (window as unknown as Record<string, number>)[key], MARKER);
}

/** Clicks a sidebar link and checks URL, heading and that the document was not reloaded. */
async function goTo(page: Page, label: string, url: RegExp, heading: string) {
  await navLink(page, label).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(navLink(page, label)).toHaveAttribute("aria-current", "page");
  expect(await readMarker(page)).toBe(1);
}

test.describe("app shell and board", () => {
  test("sidebar counts match the database and views change without a reload", async ({
    page,
    context,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);

    const collectionId = await createCollection(session, "Reading list", "📚");
    // Inserted out of alphabetical order so the Title sort visibly differs from Manual.
    const seeded = await seedItems(session, [
      { kind: "note", title: "Charlie note" },
      { kind: "note", title: "Alpha note" },
      { kind: "note", title: "Bravo note", is_read: true },
      { kind: "pdf", title: "Delta paper", file_name: "delta.pdf" },
      { kind: "code", title: "Echo snippet", is_favorite: true },
      {
        kind: "link",
        title: "Zulu link",
        url: "https://zulu.example/a",
        domain: "zulu.example",
        collection_id: collectionId,
      },
      {
        kind: "link",
        title: "Yankee link",
        url: "https://yankee.example/b",
        domain: "yankee.example",
        collection_id: collectionId,
      },
      { kind: "link", title: "Archived link", archived_at: new Date().toISOString() },
      { kind: "image", title: "Trashed image", deleted_at: new Date().toISOString() },
    ]);
    const tagged = seeded.filter((item) =>
      ["Delta paper", "Echo snippet"].includes(item.title ?? ""),
    );
    const tagId = await tagItems(
      session,
      "reading",
      tagged.map((item) => item.id),
    );

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();

    await expectCount(page, "Inbox", 5);
    await expectCount(page, "All", 7);
    await expectCount(page, "Unread", 6);
    await expectCount(page, "Favorites", 1);
    await expectCount(page, "Archive", 1);
    await expectCount(page, "Trash", 1);
    await expectCount(page, "Notes", 3);
    await expectCount(page, "Links", 2);
    await expectCount(page, "PDFs", 1);
    await expectCount(page, "Code", 1);
    await expectCount(page, "Reading list", 2);
    // Kinds without live items are not listed (Images only has a trashed item).
    await expect(navLink(page, "Videos")).toHaveCount(0);
    await expect(navLink(page, "Images")).toHaveCount(0);
    await expect(accountGroup(page)).toContainText("Guest");

    await expect(tileTitles(page)).toHaveText([
      "Charlie note",
      "Alpha note",
      "Bravo note",
      "Delta paper",
      "Echo snippet",
    ]);
    await expect(navLink(page, "Inbox")).toHaveAttribute("aria-current", "page");

    // From here on every move must be a client navigation.
    await setMarker(page);

    await goTo(page, "Reading list", new RegExp(`/app/c/${collectionId}$`), "📚 Reading list");
    await expect(tileTitles(page)).toHaveText(["Zulu link", "Yankee link"]);

    await goTo(page, "PDFs", /\/app\/f\/pdf$/, "PDFs");
    await expect(tileTitles(page)).toHaveText(["Delta paper"]);

    await goTo(page, "Unread", /\/app\/unread$/, "Unread");
    await expect(tileTitles(page)).toHaveText([
      "Charlie note",
      "Alpha note",
      "Delta paper",
      "Echo snippet",
      "Zulu link",
      "Yankee link",
    ]);

    await goTo(page, "Favorites", /\/app\/favorites$/, "Favorites");
    await expect(tileTitles(page)).toHaveText(["Echo snippet"]);

    await goTo(page, "#reading", new RegExp(`/app/t/${tagId}$`), "#reading");
    await expect(tileTitles(page)).toHaveText(["Delta paper", "Echo snippet"]);

    await goTo(page, "Archive", /\/app\/archive$/, "Archive");
    await expect(tileTitles(page)).toHaveText(["Archived link"]);

    await goTo(page, "Trash", /\/app\/trash$/, "Trash");
    await expect(tileTitles(page)).toHaveText(["Trashed image"]);

    await goTo(page, "Inbox", /\/app$/, "Inbox");
    await expect(tileTitles(page)).toHaveCount(5);

    // Sort by title: the URL carries it, the order is alphabetical, still no reload.
    await page.getByRole("button", { name: /^Sort:/ }).click();
    await page.getByRole("menuitemradio", { name: "Title" }).click();
    await expect(page).toHaveURL(/\/app\?sort=title$/);
    await expect(tileTitles(page)).toHaveText([
      "Alpha note",
      "Bravo note",
      "Charlie note",
      "Delta paper",
      "Echo snippet",
    ]);
    expect(await readMarker(page)).toBe(1);

    // The sort survives a reload (the server prefetches the same order).
    await page.reload();
    await expect(tileTitles(page).first()).toHaveText("Alpha note");

    consoleErrors.assertNone();
  });

  test("an empty account shows the inbox empty state and no formats", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);

    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Drop anything here." }),
    ).toBeVisible();
    await expect(page.getByText("No collections yet")).toBeVisible();
    await expect(sidebar(page).getByRole("heading", { name: "Formats" })).toHaveCount(0);

    await setMarker(page);
    await navLink(page, "Trash").click();
    await expect(page).toHaveURL(/\/app\/trash$/);
    await expect(page.getByRole("heading", { level: 2, name: "Trash is empty." })).toBeVisible();
    expect(await readMarker(page)).toBe(1);
    consoleErrors.assertNone();
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    await startGuest(page);

    for (const route of ["/app/nope", "/app/c/not-a-uuid", "/app/f/spaceship"]) {
      await page.goto(route);
      await expect(page.getByText("This page could not be found.")).toBeVisible();
    }
  });

  test("a well-formed but unknown collection id shows a not-found board", async ({ page }) => {
    await startGuest(page);
    await page.goto("/app/c/6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f");
    await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "This page doesn't exist." }),
    ).toBeVisible();

    await setMarker(page);
    await page.getByRole("link", { name: "Go to Inbox" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
    expect(await readMarker(page)).toBe(1);
  });

  test("loads more pages: the 55th item appears after scrolling to the end", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const session = await readSession(context);
    await createNotes(session, 55, "Note");
    await page.reload();

    await expect(page.getByText("Note 50", { exact: true })).toBeVisible();
    await expect(page.getByText("Note 55", { exact: true })).toHaveCount(0);

    const loadMore = page.getByRole("button", { name: "Load more" });
    await loadMore.scrollIntoViewIfNeeded();
    // The intersection observer usually loads the next page on scroll; the button is the fallback.
    await expect(async () => {
      if (await loadMore.isVisible()) await loadMore.click({ timeout: 1_000 }).catch(() => {});
      await expect(page.getByText("Note 55", { exact: true })).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(tileTitles(page)).toHaveCount(55);
    await expect(loadMore).toHaveCount(0);
  });

  test("grid and list modes, and the canvas toggle is disabled", async ({ page, context }) => {
    await startGuest(page);
    await createNotes(await readSession(context), 2, "Mode");
    await page.reload();

    await expect(page.locator('[data-view-mode="grid"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Canvas view" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The choice is remembered across a reload.
    await page.reload();
    await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
  });

  test("the sidebar collapses on desktop", async ({ page }) => {
    await startGuest(page);
    await expect(sidebar(page)).toBeVisible();
    await page.getByRole("button", { name: "Hide sidebar" }).click();
    await expect(sidebar(page)).toBeHidden();
    await page.getByRole("button", { name: "Show sidebar" }).click();
    await expect(sidebar(page)).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("the sidebar opens as a drawer, closes on navigation and the page does not scroll sideways", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    await createNotes(await readSession(context), 3, "Phone");
    await page.reload();
    await expect(tileTitles(page)).toHaveCount(3);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Closed drawer: no visible sidebar.
    await expect(sidebar(page)).toBeHidden();
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await expect(sidebar(page)).toBeVisible();

    await setMarker(page);
    await navLink(page, "Notes").click();
    await expect(page).toHaveURL(/\/app\/f\/note$/);
    await expect(sidebar(page)).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
    expect(await readMarker(page)).toBe(1);
  });
});
