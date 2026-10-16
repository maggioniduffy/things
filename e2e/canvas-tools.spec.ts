import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import {
  createCollection,
  fetchCanvasRows,
  readSession,
  seedItems,
  startGuest,
  type AppSession,
} from "./helpers/session";

test.describe.configure({ timeout: 120_000 });

/** React Flow positions a node with `transform: translate(Xpx, Ypx)`: these are flow coordinates. */
async function nodeFlowPosition(page: Page, id: string) {
  const transform = await page
    .locator(`.react-flow__node[data-id="${id}"]`)
    .evaluate((node) => (node as HTMLElement).style.transform);
  const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
  if (!match) throw new Error(`No translate in "${transform}".`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function domViewport(page: Page) {
  const transform = await page
    .locator(".react-flow__viewport")
    .evaluate((node) => (node as HTMLElement).style.transform);
  const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/);
  if (!match) throw new Error(`No viewport transform in "${transform}".`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}

/** Flow coordinates of a screen point, from the pane box and the viewport transform. */
async function flowPointAt(page: Page, client: { x: number; y: number }) {
  const box = await page.locator(".react-flow").boundingBox();
  if (!box) throw new Error("Canvas has no box.");
  const view = await domViewport(page);
  return { x: (client.x - box.x - view.x) / view.zoom, y: (client.y - box.y - view.y) / view.zoom };
}

async function openCanvas(page: Page, url: string) {
  await page.goto(url);
  const toggle = page.getByRole("button", { name: "Canvas view" });
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

/** A point on empty canvas well away from the seeded cards (below them). */
async function emptyPoint(page: Page, dx = 0, dy = 0) {
  const box = await page.locator(".react-flow").boundingBox();
  if (!box) throw new Error("Canvas has no box.");
  return { x: box.x + box.width * 0.5 + dx, y: box.y + box.height * 0.85 + dy };
}

/** Selects the card with a marquee drawn from empty space above-left of it to its center. */
async function marqueeSelect(page: Page, id: string) {
  const box = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
  if (!box) throw new Error("Node has no box.");
  await page.mouse.move(box.x - 24, box.y - 24);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(`.react-flow__node[data-id="${id}"]`)).toHaveClass(/selected/);
}

const isLayoutRpc = (url: string) => url.includes("/rest/v1/rpc/save_canvas_layout");

async function seedPlaced(session: AppSession, collectionId: string | null) {
  return seedItems(
    session,
    ["Alpha", "Beta"].map((title, index) => ({
      kind: "note",
      title,
      ...(collectionId ? { collection_id: collectionId } : {}),
      canvas_x: index * 320,
      canvas_y: 0,
    })),
  );
}

async function rowOf(session: AppSession, collectionId: string | null, id: string) {
  const row = (await fetchCanvasRows(session, collectionId)).find((r) => r.id === id);
  if (!row) throw new Error("Row not found.");
  return row;
}

test.describe("canvas tools", () => {
  test("a dropped file lands centered under the cursor and stays after a reload", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    await seedPlaced(session, null);
    await openCanvas(page, "/app");

    const at = await emptyPoint(page);
    const flow = await flowPointAt(page, at);
    await page.evaluate(
      ([x, y]) => {
        const data = new DataTransfer();
        data.items.add(new File(["hello"], "dropped.txt", { type: "text/plain" }));
        const pane = document.querySelector(".react-flow__pane") ?? document.body;
        pane.dispatchEvent(
          new DragEvent("drop", {
            dataTransfer: data,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [at.x, at.y] as const,
    );

    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    const view = await domViewport(page);
    await expect.poll(async () => (await fetchCanvasRows(session, null)).length).toBe(3);
    const row = (await fetchCanvasRows(session, null)).find((r) => r.title === "dropped");
    if (!row || row.canvas_x === null || row.canvas_y === null) throw new Error("No position.");

    // Its center is the drop point: the node is 240 x 200 flow px by default for a file.
    const node = page.locator(".react-flow__node", { hasText: "dropped" });
    const nodeBox = await node.boundingBox();
    if (!nodeBox) throw new Error("No node box.");
    expect(nodeBox.x + nodeBox.width / 2).toBeCloseTo(at.x, 0);
    expect(nodeBox.y + nodeBox.height / 2).toBeCloseTo(at.y, 0);
    expect(row.canvas_x + nodeBox.width / view.zoom / 2).toBeCloseTo(flow.x, 0);
    expect(row.canvas_y + nodeBox.height / view.zoom / 2).toBeCloseTo(flow.y, 0);

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    const after = await nodeFlowPosition(page, row.id);
    expect(after.x).toBeCloseTo(row.canvas_x, 0);
    expect(after.y).toBeCloseTo(row.canvas_y, 0);
    errors.assertNone();
  });

  test("a double-click makes a note there and opens it in the drawer", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    await seedPlaced(session, null);
    await openCanvas(page, "/app");

    const at = await emptyPoint(page, -150);
    const flow = await flowPointAt(page, at);
    await page.mouse.dblclick(at.x, at.y);

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Note" })).toBeFocused();
    await expect(page.locator(".react-flow__node")).toHaveCount(3);

    // A note is 240 x 160 by default; the center is the click.
    await expect.poll(async () => (await fetchCanvasRows(session, null)).length).toBe(3);
    const rows = await fetchCanvasRows(session, null);
    const fresh = rows.find((r) => r.title === null);
    if (!fresh || fresh.canvas_x === null || fresh.canvas_y === null) throw new Error("No note.");
    expect(fresh.canvas_x).toBeCloseTo(flow.x - 120, 0);
    expect(fresh.canvas_y).toBeCloseTo(flow.y - 80, 0);

    // Type into it, close, and the card shows the text.
    await page.keyboard.type("Remember this");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "Open Remember this" })).toBeVisible();
    errors.assertNone();
  });

  test("N creates a note at the viewport center", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    await seedPlaced(session, null);
    await openCanvas(page, "/app");
    const box = await page.locator(".react-flow").boundingBox();
    if (!box) throw new Error("Canvas has no box.");
    const flow = await flowPointAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

    await page.keyboard.press("n");
    await expect(page.getByRole("textbox", { name: "Note" })).toBeFocused();
    await expect.poll(async () => (await fetchCanvasRows(session, null)).length).toBe(3);
    const fresh = (await fetchCanvasRows(session, null)).find((r) => r.title === null);
    expect(fresh?.canvas_x).toBeCloseTo(flow.x - 120, 0);
    expect(fresh?.canvas_y).toBeCloseTo(flow.y - 80, 0);
  });

  test("a resized card keeps its size after a reload", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    const [alpha] = await seedPlaced(session, null);
    if (!alpha) throw new Error("No seeded item.");
    await openCanvas(page, "/app");

    await marqueeSelect(page, alpha.id);
    const handle = page.locator(
      `.react-flow__node[data-id="${alpha.id}"] .react-flow__resize-control.handle.bottom.right`,
    );
    await expect(handle).toBeVisible();
    const before = await page.locator(`.react-flow__node[data-id="${alpha.id}"]`).boundingBox();
    const view = await domViewport(page);
    const handleBox = await handle.boundingBox();
    if (!before || !handleBox) throw new Error("No boxes.");

    const saved = page.waitForRequest((request) => isLayoutRpc(request.url()));
    const x = handleBox.x + handleBox.width / 2;
    const y = handleBox.y + handleBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y + 60, { steps: 8 });
    await page.mouse.up();
    await saved;

    const wanted = { w: (before.width + 90) / view.zoom, h: (before.height + 60) / view.zoom };
    await expect
      .poll(async () => (await rowOf(session, null, alpha.id)).canvas_w)
      .toBeCloseTo(wanted.w, 0);
    expect((await rowOf(session, null, alpha.id)).canvas_h).toBeCloseTo(wanted.h, 0);

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    const reloadedView = await domViewport(page);
    const after = await page.locator(`.react-flow__node[data-id="${alpha.id}"]`).boundingBox();
    expect((after?.width ?? 0) / reloadedView.zoom).toBeCloseTo(wanted.w, 0);
    expect((after?.height ?? 0) / reloadedView.zoom).toBeCloseTo(wanted.h, 0);
  });

  test("] brings a card to front and the z survives a reload", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    const [alpha, beta] = await seedPlaced(session, null);
    if (!alpha || !beta) throw new Error("No seeded items.");
    await openCanvas(page, "/app");

    await marqueeSelect(page, alpha.id);
    const saved = page.waitForRequest((request) => isLayoutRpc(request.url()));
    await page.keyboard.press("]");
    await saved;
    await expect.poll(async () => (await rowOf(session, null, alpha.id)).canvas_z).toBe(1);
    expect((await rowOf(session, null, beta.id)).canvas_z).toBe(0);

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    const z = (id: string) =>
      page
        .locator(`.react-flow__node[data-id="${id}"]`)
        .evaluate((n) => (n as HTMLElement).style.zIndex);
    expect(await z(alpha.id)).toBe("1");
    expect(await z(beta.id)).toBe("0");
  });

  test("M moves the selected card to a collection and it leaves the Inbox canvas", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const [alpha] = await seedPlaced(session, null);
    if (!alpha) throw new Error("No seeded item.");
    const targetId = await createCollection(session, "Reading list", "📚");
    await openCanvas(page, "/app");

    // Nothing selected: M does nothing.
    await page.keyboard.press("m");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await marqueeSelect(page, alpha.id);
    await page.keyboard.press("m");
    await expect(page.getByRole("dialog", { name: "Move 1 item to…" })).toBeVisible();
    await page.getByRole("option", { name: "Reading list" }).click();

    await expect(page.locator(`.react-flow__node[data-id="${alpha.id}"]`)).toHaveCount(0);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect
      .poll(async () => (await fetchCanvasRows(session, targetId)).map((r) => r.id))
      .toEqual([alpha.id]);
    errors.assertNone();
  });

  test("the node context menu moves a card and the pane menu makes a note", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const session = await readSession(context);
    const [alpha, beta] = await seedPlaced(session, null);
    if (!alpha || !beta) throw new Error("No seeded items.");
    const targetId = await createCollection(session, "Archive box", "🗃️");
    await openCanvas(page, "/app");

    await page.locator(`.react-flow__node[data-id="${beta.id}"]`).click({ button: "right" });
    await page.getByRole("menuitem", { name: /Move to/ }).hover();
    await page.getByRole("menuitem", { name: "Archive box" }).click();
    await expect(page.locator(`.react-flow__node[data-id="${beta.id}"]`)).toHaveCount(0);
    await expect
      .poll(async () => (await fetchCanvasRows(session, targetId)).map((r) => r.id))
      .toEqual([beta.id]);

    const at = await emptyPoint(page, 100);
    await page.mouse.click(at.x, at.y, { button: "right" });
    await page.getByRole("menuitem", { name: "New note here" }).click();
    await expect(page.getByRole("textbox", { name: "Note" })).toBeFocused();
  });

  test("snap to grid keeps a dragged card on the 8 px grid", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    const [alpha] = await seedPlaced(session, null);
    if (!alpha) throw new Error("No seeded item.");
    await openCanvas(page, "/app");

    const snap = page.getByRole("button", { name: "Snap to grid" });
    await expect(snap).toHaveAttribute("aria-pressed", "false");
    await snap.click();
    await expect(snap).toHaveAttribute("aria-pressed", "true");

    const box = await page.locator(`.react-flow__node[data-id="${alpha.id}"]`).boundingBox();
    if (!box) throw new Error("No box.");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 53, y + 37, { steps: 8 });
    await page.mouse.up();

    const position = await nodeFlowPosition(page, alpha.id);
    expect(position.x % 8).toBeCloseTo(0, 5);
    expect(position.y % 8).toBeCloseTo(0, 5);
  });
});
