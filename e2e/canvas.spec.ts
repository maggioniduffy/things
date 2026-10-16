import { expect, test } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { createCollection, readSession, seedCanvasItems, startGuest } from "./helpers/session";

const COUNT = 300;

test.describe("canvas", () => {
  // Seeding is one request per item.
  test.setTimeout(180_000);

  test("shows a collection as a canvas, opens a card, and falls back to grid elsewhere", async ({
    page,
    context,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Moodboard", "🎨");
    await seedCanvasItems(session, COUNT, { collectionId });

    await page.goto(`/app/c/${collectionId}`);
    await expect(page.getByRole("heading", { level: 1, name: "🎨 Moodboard" })).toBeVisible();

    const canvasToggle = page.getByRole("button", { name: "Canvas view" });
    await expect(canvasToggle).not.toHaveAttribute("aria-disabled", "true");
    await canvasToggle.click();
    await expect(canvasToggle).toHaveAttribute("aria-pressed", "true");

    const canvas = page.getByRole("region", { name: "Canvas" });
    await expect(canvas).toBeVisible();
    // Every page is drained before the canvas mounts.
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(COUNT);
    // Item 1 has a stored position (0, 0): its node exists. The view is centered on the whole
    // content, which is a tall column of auto-placed items, so pick a node that is on screen.
    await expect(
      page.getByRole("button", { name: "Open Canvas item 1", exact: true }),
    ).toBeAttached();
    const visibleId = await page.evaluate(() => {
      const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
      if (!pane) return null;
      for (const node of document.querySelectorAll<HTMLElement>(".react-flow__node")) {
        const box = node.getBoundingClientRect();
        // Clear of the controls (bottom left) and fully inside the pane.
        if (box.top > pane.top + 20 && box.bottom < pane.bottom - 20 && box.left > pane.left + 100)
          return node.dataset.id ?? null;
      }
      return null;
    });
    if (!visibleId) throw new Error("No canvas node is on screen.");
    const node = page.locator(`.react-flow__node[data-id="${visibleId}"]`);
    const first = node.getByRole("button", { name: /^Open / });
    await expect(first).toBeVisible();

    // Cards are the grid's tiles, but the grid itself is gone; the minimap toggles from the controls.
    await expect(page.locator('[data-slot="item-tile"]').first()).toBeVisible();
    await expect(page.locator('[data-view-mode="grid"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Show minimap" }).click();
    await expect(page.locator(".react-flow__minimap")).toBeVisible();

    // A click on a card selects it; a double-click or the open button on hover opens the drawer.
    await first.click();
    await expect(node).toHaveClass(/selected/);
    await expect(page).not.toHaveURL(/item=/);
    await first.dblclick();
    await expect(page).toHaveURL(/\?item=[0-9a-f-]{36}$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await node.hover();
    await node.locator('button[title="Open"]').click();
    await expect(page).toHaveURL(/\?item=[0-9a-f-]{36}$/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A drag moves the node and does not open the drawer.
    const before = await first.boundingBox();
    if (!before) throw new Error("Card has no box.");
    const x = before.x + before.width / 2;
    const y = before.y + before.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 40, { steps: 8 });
    await page.mouse.up();
    const after = await first.boundingBox();
    expect(after?.x).toBeGreaterThan(before.x + 20);
    await expect(page).not.toHaveURL(/item=/);

    // Canvas is for the Inbox and collections; another view shows the persisted mode as grid.
    await page
      .getByRole("navigation", { name: "Sidebar" })
      .getByRole("link", { name: /^All(\s|$)/ })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Canvas view" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    consoleErrors.assertNone();
  });
});
