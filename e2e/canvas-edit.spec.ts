import { expect, test, type Page } from "@playwright/test";
import {
  createCollection,
  fetchCanvasRows,
  readSession,
  seedItems,
  startGuest,
  type AppSession,
} from "./helpers/session";

test.describe.configure({ timeout: 120_000 });

type Point = { x: number; y: number };

/** React Flow positions a node with `transform: translate(Xpx, Ypx)`: these are flow coordinates. */
async function nodeFlowPosition(page: Page, id: string): Promise<Point> {
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

async function canvasBox(page: Page) {
  const box = await page.locator(".react-flow").boundingBox();
  if (!box) throw new Error("Canvas has no box.");
  return box;
}

/** The flow point under a client (screen) point. */
async function toFlow(page: Page, client: Point): Promise<Point> {
  const [vp, box] = await Promise.all([domViewport(page), canvasBox(page)]);
  return { x: (client.x - box.x - vp.x) / vp.zoom, y: (client.y - box.y - vp.y) / vp.zoom };
}

async function openCanvas(page: Page, url: string) {
  await page.goto(url);
  const toggle = page.getByRole("button", { name: "Canvas view" });
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

/** A left-drag on empty space draws a marquee that selects the cards inside it. */
async function marquee(page: Page, from: Point, to: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function nodeBox(page: Page, id: string) {
  const box = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
  if (!box) throw new Error("Node has no box.");
  return box;
}

/** Selects one card by drawing a marquee around it. */
async function selectCard(page: Page, id: string) {
  const box = await nodeBox(page, id);
  await marquee(
    page,
    { x: box.x - 12, y: box.y - 12 },
    { x: box.x + box.width + 12, y: box.y + box.height + 12 },
  );
  await expect(page.locator(`.react-flow__node[data-id="${id}"]`)).toHaveClass(/selected/);
}

async function rowByTitle(session: AppSession, collectionId: string | null, title: string) {
  return (await fetchCanvasRows(session, collectionId)).find((row) => row.title === title);
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("canvas editing", () => {
  test("placing, resizing, layering, zooming and moving cards", async ({ page, context }) => {
    const errors = collectErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Edit source", "✏️");
    const otherId = await createCollection(session, "Edit target", "🎯");

    // Spread out so fitting everything zooms out below 100%. "Under" is big and sits partly below "Top".
    const seeded = await seedItems(session, [
      { kind: "note", title: "Top", collection_id: collectionId, canvas_x: 0, canvas_y: 0 },
      {
        kind: "note",
        title: "Under",
        collection_id: collectionId,
        canvas_x: 60,
        canvas_y: 60,
        canvas_w: 600,
        canvas_h: 400,
      },
      { kind: "note", title: "Far", collection_id: collectionId, canvas_x: 3200, canvas_y: 1800 },
      { kind: "note", title: "Elsewhere", collection_id: otherId, canvas_x: 0, canvas_y: 0 },
    ]);
    const idOf = (title: string) => {
      const found = seeded.find((item) => item.title === title);
      if (!found) throw new Error(`No seeded ${title}.`);
      return found.id;
    };
    const positionsBefore = new Map(
      [
        ...(await fetchCanvasRows(session, collectionId)),
        ...(await fetchCanvasRows(session, otherId)),
      ].map((row) => [row.id, row.position]),
    );

    await openCanvas(page, `/app/c/${collectionId}`);
    // Start from a known view: 100%, with the origin in the upper left.
    await page.keyboard.press("Shift+Digit0");
    await expect.poll(async () => (await domViewport(page)).zoom).toBeCloseTo(1, 2);

    // (f) Shift+1 fits everything (zooms out); Shift+0 goes back to 100%.
    await page.keyboard.press("Shift+Digit1");
    await expect.poll(async () => (await domViewport(page)).zoom).toBeLessThan(0.9);
    await page.keyboard.press("Shift+Digit0");
    await expect.poll(async () => (await domViewport(page)).zoom).toBeCloseTo(1, 2);
    // ⌘/Ctrl + = and - zoom without the browser zooming the page.
    await page.keyboard.press("ControlOrMeta+Equal");
    await expect.poll(async () => (await domViewport(page)).zoom).toBeGreaterThan(1.1);
    await page.keyboard.press("ControlOrMeta+Minus");
    await expect.poll(async () => (await domViewport(page)).zoom).toBeLessThan(1.05);
    // Bring the top-left content into the middle of the screen at a known zoom.
    await page.keyboard.press("Shift+Digit1");
    await expect.poll(async () => (await domViewport(page)).zoom).toBeLessThan(0.9);
    await page.keyboard.press("Shift+Digit0");

    // (a) A file dropped on a point lands with its top-left there, and stays after a reload.
    const box = await canvasBox(page);
    const dropClient = { x: box.x + box.width - 320, y: box.y + 90 };
    const dropFlow = await toFlow(page, dropClient);
    await page.evaluate(({ x, y }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["hello"], "dropped.txt", { type: "text/plain" }));
      const target = document.elementFromPoint(x, y) ?? document.body;
      for (const type of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer: transfer,
          }),
        );
      }
    }, dropClient);
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, "dropped"))?.canvas_x)
      .not.toBeNull();
    const dropped = await rowByTitle(session, collectionId, "dropped");
    if (!dropped) throw new Error("The dropped file was not saved.");
    expect(dropped.canvas_x).toBeCloseTo(dropFlow.x, -1);
    expect(Math.abs((dropped.canvas_x ?? 0) - dropFlow.x)).toBeLessThanOrEqual(8);
    expect(Math.abs((dropped.canvas_y ?? 0) - dropFlow.y)).toBeLessThanOrEqual(8);
    const droppedNode = await nodeFlowPosition(page, dropped.id);
    expect(Math.abs(droppedNode.x - dropFlow.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(droppedNode.y - dropFlow.y)).toBeLessThanOrEqual(8);

    // (b) Double-click empty space, type, ⌘/Ctrl+Enter: a note appears right there.
    const noteClient = { x: box.x + 40, y: box.y + box.height - 260 };
    const noteFlow = await toFlow(page, noteClient);
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("react-flow__pane"),
        noteClient,
      ),
    ).toBe(true);
    await page.mouse.dblclick(noteClient.x, noteClient.y);
    const composer = page.getByRole("textbox", { name: "New note" });
    await expect(composer).toBeFocused();
    await expect(composer).toHaveAttribute("placeholder", "Write a note");
    await composer.fill("Hello canvas");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(composer).toBeHidden();
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, ""))?.canvas_x)
      .toBeDefined();
    const notes = (await fetchCanvasRows(session, collectionId)).filter(
      (row) => !seeded.some((item) => item.id === row.id) && row.id !== dropped.id,
    );
    expect(notes).toHaveLength(1);
    const note = notes[0]!;
    expect(Math.abs((note.canvas_x ?? 1e9) - noteFlow.x)).toBeLessThanOrEqual(8);
    expect(Math.abs((note.canvas_y ?? 1e9) - noteFlow.y)).toBeLessThanOrEqual(8);

    // (c) Resize the "Top" card from its bottom-right handle; the minimum size holds.
    const topId = idOf("Top");
    await selectCard(page, topId);
    const handle = page.locator(
      `.react-flow__node[data-id="${topId}"] .react-flow__resize-control.handle.bottom.right`,
    );
    await expect(handle).toBeVisible();
    const before = await nodeBox(page, topId);
    async function dragHandle(dx: number, dy: number) {
      const h = await handle.boundingBox();
      if (!h) throw new Error("Resize handle has no box.");
      const x = h.x + h.width / 2;
      const y = h.y + h.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 8 });
      await page.mouse.up();
    }
    await dragHandle(80, 50);
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, "Top"))?.canvas_w)
      .toBeGreaterThan(before.width + 40);
    const grown = await rowByTitle(session, collectionId, "Top");
    expect(grown?.canvas_h).toBeGreaterThan(before.height + 20);

    await dragHandle(-2000, -2000);
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, "Top"))?.canvas_w)
      .toBe(160);
    expect((await rowByTitle(session, collectionId, "Top"))?.canvas_h).toBe(120);

    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    const afterReload = await nodeBox(page, topId);
    const vp = await domViewport(page);
    expect(afterReload.width / vp.zoom).toBeCloseTo(160, 0);
    expect(afterReload.height / vp.zoom).toBeCloseTo(120, 0);
    // The dropped file and the note are where they were put.
    const droppedAgain = await nodeFlowPosition(page, dropped.id);
    expect(Math.abs(droppedAgain.x - dropFlow.x)).toBeLessThanOrEqual(8);
    const noteAgain = await nodeFlowPosition(page, note.id);
    expect(Math.abs(noteAgain.x - noteFlow.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(noteAgain.y - noteFlow.y)).toBeLessThanOrEqual(8);

    // (d) `]` raises the selected card above the one it overlaps, and the z is saved.
    const zBefore = (await rowByTitle(session, collectionId, "Top"))?.canvas_z ?? 0;
    const underZ = (await rowByTitle(session, collectionId, "Under"))?.canvas_z ?? 0;
    await selectCard(page, topId);
    await page.keyboard.press("]");
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, "Top"))?.canvas_z)
      .toBe(Math.max(zBefore, underZ + 1));
    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    expect((await rowByTitle(session, collectionId, "Top"))?.canvas_z).toBeGreaterThan(underZ);
    await selectCard(page, topId);
    await page.keyboard.press("[");
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, "Top"))?.canvas_z)
      .toBeLessThan(underZ);

    // (e) `M` opens the move menu; picking a collection moves the card and it is auto-placed there.
    await selectCard(page, topId);
    await page.keyboard.press("m");
    const menu = page.getByRole("menu", { name: "Move to" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Edit source" })).toHaveAttribute(
      "data-disabled",
      "",
    );
    await menu.getByRole("menuitem", { name: "Edit target" }).click();
    await expect(page.locator(`.react-flow__node[data-id="${topId}"]`)).toHaveCount(0);
    await expect.poll(async () => (await rowByTitle(session, otherId, "Top"))?.id).toBe(topId);
    await page.goto(`/app/c/${otherId}`);
    await expect(page.locator(`.react-flow__node[data-id="${topId}"]`)).toBeVisible();
    await expect
      .poll(async () => (await rowByTitle(session, otherId, "Top"))?.canvas_x)
      .not.toBeNull();

    // (g) Nothing above touched the grid order.
    const rows = [
      ...(await fetchCanvasRows(session, collectionId)),
      ...(await fetchCanvasRows(session, otherId)),
    ];
    for (const row of rows) {
      if (positionsBefore.has(row.id)) expect(row.position).toBe(positionsBefore.get(row.id));
    }
    expect(errors).toEqual([]);
  });

  test("the card menu moves and layers, the pane menu adds a note", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Menu source", "🧭");
    const otherId = await createCollection(session, "Menu target", "🏁");
    const [first] = await seedItems(session, [
      { kind: "note", title: "Menu card", collection_id: collectionId, canvas_x: 0, canvas_y: 0 },
      {
        kind: "note",
        title: "Menu other",
        collection_id: collectionId,
        canvas_x: 80,
        canvas_y: 40,
      },
    ]);
    if (!first) throw new Error("No seeded item.");

    await openCanvas(page, `/app/c/${collectionId}`);
    const box = await nodeBox(page, first.id);
    // Right-click the visible top-left corner of the first card (the other overlaps its lower part).
    await page.mouse.click(box.x + 8, box.y + 8, { button: "right" });
    await expect(page.locator(`.react-flow__node[data-id="${first.id}"]`)).toHaveClass(/selected/);
    await page.getByRole("menuitem", { name: "Bring to front" }).click();
    await expect
      .poll(async () => (await rowByTitle(session, collectionId, "Menu card"))?.canvas_z)
      .toBeGreaterThan(0);

    await page.mouse.click(box.x + 8, box.y + 8, { button: "right" });
    await page.getByRole("menuitem", { name: "Move to…" }).click();
    await page.getByRole("menuitem", { name: "Menu target" }).click();
    await expect(page.locator(`.react-flow__node[data-id="${first.id}"]`)).toHaveCount(0);
    await expect
      .poll(async () => (await rowByTitle(session, otherId, "Menu card"))?.id)
      .toBe(first.id);

    // Empty space: New note here opens the composer.
    const canvas = await canvasBox(page);
    await page.mouse.click(canvas.x + 30, canvas.y + 30, { button: "right" });
    await page.getByRole("menuitem", { name: "New note here" }).click();
    await expect(page.getByRole("textbox", { name: "New note" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("textbox", { name: "New note" })).toBeHidden();
  });
});
