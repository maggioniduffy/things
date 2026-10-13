import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { createCollection, readSession, seedItems, startGuest } from "./helpers/session";

const TITLES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];

async function seed(page: Page, context: Parameters<typeof readSession>[0]) {
  const session = await readSession(context);
  const collectionId = await createCollection(session, "Reading");
  await seedItems(
    session,
    TITLES.map((title, index) => ({ kind: "note", title, position: `a${index}` })),
  );
  await page.reload();
  return { session, collectionId };
}

function tileTitles(page: Page) {
  return page.locator('[data-slot="item-tile"] > p:first-of-type');
}

function card(page: Page, title: string) {
  return page.getByRole("button", { name: `Open ${title}` });
}

function selectedCards(page: Page) {
  return page.locator('[data-selected="true"]');
}

/** Counts writes (not reads) that reach the items endpoint; refetches after a drop are GETs. */
function countItemWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/rest/v1/items")) {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });
  return writes;
}

/** Builds the selection One, Two, Three (Shift range) + Four + Five (⌘/Ctrl-click). */
async function selectFive(page: Page) {
  await card(page, "One").click({ modifiers: ["ControlOrMeta"] });
  await card(page, "Three").click({ modifiers: ["Shift"] });
  await card(page, "Four").click({ modifiers: ["ControlOrMeta"] });
  await card(page, "Five").click({ modifiers: ["ControlOrMeta"] });
  await expect(selectedCards(page)).toHaveCount(5);
  await expect(page).not.toHaveURL(/item=/);
}

/** A pointer drag from the center of `from` to the center of `to`, in small steps. */
async function drag(
  page: Page,
  from: ReturnType<Page["locator"]>,
  to: ReturnType<Page["locator"]>,
) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error("No boxes to drag between.");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
}

test.describe("multi-select and drag to the sidebar", () => {
  test("⌘/Ctrl-click and Shift-click build a selection, Escape clears it", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    await selectFive(page);
    await page.keyboard.press("Escape");
    await expect(selectedCards(page)).toHaveCount(0);

    await page.getByRole("button", { name: "List view" }).click();
    await card(page, "Two").click({ modifiers: ["ControlOrMeta"] });
    await card(page, "Four").click({ modifiers: ["Shift"] });
    await expect(selectedCards(page)).toHaveCount(3);
    errors.assertNone();
  });

  test("dragging 5 selected cards onto a collection is one request and persists", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const { collectionId } = await seed(page, context);
    await expect(tileTitles(page)).toHaveText(TITLES);
    await selectFive(page);

    const writes = countItemWrites(page);
    const target = page.getByRole("link", { name: /^Reading/ });
    await drag(page, card(page, "Two"), target);
    // Hover state: the aurora ring is showing while the cards are over the row.
    await expect(target.locator('[data-slot="drop-ring"]')).toHaveAttribute("data-over", "true");
    await page.mouse.up();

    await expect(tileTitles(page)).toHaveText(["Six", "Seven", "Eight"]);
    await expect(selectedCards(page)).toHaveCount(0);
    await expect(page.getByText("Moved 5 items to Reading")).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toContain("PATCH");
    expect(writes[0]).toContain("id=in.");

    await page.reload();
    await expect(tileTitles(page)).toHaveText(["Six", "Seven", "Eight"]);
    await page.goto(`/app/c/${collectionId}`);
    await expect(tileTitles(page)).toHaveText(["One", "Two", "Three", "Four", "Five"]);
    expect(writes).toHaveLength(1);
    errors.assertNone();
  });

  test("a single card dragged outside manual sort still drops on Favorites", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await page.goto("/app?sort=oldest");
    await expect(tileTitles(page)).toHaveCount(8);
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(0);

    const writes = countItemWrites(page);
    await drag(page, card(page, "Three"), page.getByRole("link", { name: /^Favorites/ }));
    await page.mouse.up();

    await expect(page.getByText("Added 1 item to Favorites")).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    await page.goto("/app/favorites");
    await expect(tileTitles(page)).toHaveText(["Three"]);
    errors.assertNone();
  });

  test("trashing a selection shows Undo, which brings the cards back", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);
    await selectFive(page);

    await drag(page, card(page, "One"), page.getByRole("link", { name: /^Trash/ }));
    await page.mouse.up();
    await expect(tileTitles(page)).toHaveText(["Six", "Seven", "Eight"]);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(tileTitles(page)).toHaveText(TITLES);
    errors.assertNone();
  });

  test("keyboard: pick up a card, move to a sidebar row, drop", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    await seed(page, context);

    const writes = countItemWrites(page);
    const handle = page.getByRole("button", { name: "Reorder One" });
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    // dnd-kit attaches its key listeners a tick after the pick-up: each step repeats until announced.
    const step = async (key: string, label: string) => {
      const announced = page.getByText(`One over ${label}.`);
      await expect(async () => {
        if (!(await announced.count())) await page.keyboard.press(key);
        await expect(announced).toBeAttached({ timeout: 500 });
      }).toPass();
    };
    await step("ArrowLeft", "Inbox");
    await step("ArrowDown", "Favorites");
    await page.keyboard.press("Space");

    await expect(page.getByText("One dropped on Favorites.")).toBeAttached();
    await expect(page.getByText("Added 1 item to Favorites")).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    errors.assertNone();
  });
});
