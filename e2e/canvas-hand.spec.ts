import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { fetchCanvasRows, readSession, seedItems, startGuest } from "./helpers/session";

test.describe.configure({ timeout: 120_000 });

test("hand tool: dragging a card pans the view and a click still opens it", async ({
  page,
  context,
}) => {
  const errors = trackConsoleErrors(page);
  await startGuest(page);
  const session = await readSession(context);
  await seedItems(session, [
    { kind: "note", title: "Alpha", position: "a0", canvas_x: 0, canvas_y: 0 },
  ]);

  await page.goto("/app");
  const toggle = page.getByRole("button", { name: "Canvas view" });
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  const node = page.locator(".react-flow__node").first();
  await expect(node).toBeVisible();

  await page.getByRole("button", { name: "Hand" }).click();
  await expect(page.getByRole("button", { name: "Hand" })).toHaveAttribute("aria-pressed", "true");

  const viewport = page.locator(".react-flow__viewport");
  const before = await viewport.evaluate((n) => (n as HTMLElement).style.transform);
  const box = await node.boundingBox();
  if (!box) throw new Error("Node has no box.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 80, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(() => viewport.evaluate((n) => (n as HTMLElement).style.transform))
    .not.toBe(before);
  const rows = await fetchCanvasRows(session, null);
  expect(rows.map((r) => [r.canvas_x, r.canvas_y])).toEqual([[0, 0]]);

  await node.getByRole("button", { name: /^Open / }).dblclick();
  await expect(page.getByRole("dialog")).toBeVisible();
  errors.assertNone();
});
