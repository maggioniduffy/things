import { expect, test, type Page } from "@playwright/test";
import {
  createCollection,
  fetchCanvasRows,
  fetchCollectionViewport,
  readSession,
  seedItems,
  startGuest,
  type AppSession,
} from "./helpers/session";

test.describe.configure({ timeout: 90_000 });

/** React Flow positions a node with `transform: translate(Xpx, Ypx)`: these are flow coordinates. */
async function nodeFlowPosition(page: Page, id: string) {
  const transform = await page
    .locator(`.react-flow__node[data-id="${id}"]`)
    .evaluate((node) => (node as HTMLElement).style.transform);
  const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
  if (!match) throw new Error(`No translate in "${transform}".`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

/** The canvas viewport as React Flow renders it. */
async function domViewport(page: Page) {
  const transform = await page
    .locator(".react-flow__viewport")
    .evaluate((node) => (node as HTMLElement).style.transform);
  const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/);
  if (!match) throw new Error(`No viewport transform in "${transform}".`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const rounded = (v: { x: number; y: number; zoom: number } | null) =>
  v && { x: round2(v.x), y: round2(v.y), zoom: round2(v.zoom) };

async function openCanvas(page: Page, url: string) {
  await page.goto(url);
  const toggle = page.getByRole("button", { name: "Canvas view" });
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

async function dragNode(page: Page, id: string, dx: number, dy: number) {
  const box = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
  if (!box) throw new Error("Node has no box.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

const isLayoutRpc = (url: string) => url.includes("/rest/v1/rpc/save_canvas_layout");

async function seedPlaced(session: AppSession, collectionId: string | null, count = 3) {
  return seedItems(
    session,
    Array.from({ length: count }, (_, index) => ({
      kind: "note",
      title: `Placed ${index + 1}`,
      ...(collectionId ? { collection_id: collectionId } : {}),
      canvas_x: index * 320,
      canvas_y: 0,
    })),
  );
}

/** Pans with the wheel and zooms with ctrl + wheel over the middle of the canvas. */
async function panAndZoom(page: Page) {
  const box = await page.locator(".react-flow").boundingBox();
  if (!box) throw new Error("Canvas has no box.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(120, 80);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
}

test.describe("canvas persistence", () => {
  test("a dragged node keeps its place after a reload and the position column is untouched", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Persist", "📌");
    const items = await seedPlaced(session, collectionId);
    const target = items[1];
    if (!target) throw new Error("No seeded item.");
    const positionsBefore = new Map(
      (await fetchCanvasRows(session, collectionId)).map((row) => [row.id, row.position]),
    );

    await openCanvas(page, `/app/c/${collectionId}`);
    const before = await nodeFlowPosition(page, target.id);

    const saved = page.waitForRequest((request) => isLayoutRpc(request.url()));
    await dragNode(page, target.id, 90, 60);
    // Nothing is sent while the pointer is still moving; the debounced save follows the drop.
    await saved;
    const moved = await nodeFlowPosition(page, target.id);
    expect(moved.x).toBeGreaterThan(before.x + 40);

    await expect
      .poll(async () => {
        const row = (await fetchCanvasRows(session, collectionId)).find((r) => r.id === target.id);
        return row && { x: row.canvas_x, y: row.canvas_y };
      })
      .toEqual({ x: expect.closeTo(moved.x, 0), y: expect.closeTo(moved.y, 0) });

    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    const afterReload = await nodeFlowPosition(page, target.id);
    expect(afterReload.x).toBeCloseTo(moved.x, 0);
    expect(afterReload.y).toBeCloseTo(moved.y, 0);

    const rows = await fetchCanvasRows(session, collectionId);
    for (const row of rows) expect(row.position).toBe(positionsBefore.get(row.id));
  });

  test("a collection's pan and zoom survive a reload", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Viewport", "🔭");
    await seedPlaced(session, collectionId);

    await openCanvas(page, `/app/c/${collectionId}`);
    await panAndZoom(page);
    // Wait for the debounced write of exactly what is on screen now.
    await expect
      .poll(
        async () =>
          rounded((await fetchCollectionViewport(session, collectionId)) as typeof expected),
        { timeout: 10_000 },
      )
      .toEqual(rounded(await domViewport(page)));
    const expected = await domViewport(page);

    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    expect(rounded(await domViewport(page))).toEqual(rounded(expected));
  });

  test("the Inbox viewport is restored from localStorage", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    await seedPlaced(session, null);

    await openCanvas(page, "/app");
    await panAndZoom(page);
    const key = `things-canvas-viewport:${session.user.id}`;
    await expect
      .poll(
        async () => {
          const raw = await page.evaluate((k) => localStorage.getItem(k), key);
          return raw && rounded(JSON.parse(raw));
        },
        { timeout: 10_000 },
      )
      .toEqual(rounded(await domViewport(page)));
    const expected = await domViewport(page);

    await page.reload();
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    expect(rounded(await domViewport(page))).toEqual(rounded(expected));
  });

  test("auto-placed items are saved in one batch", async ({ page, context }) => {
    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Loose", "🧺");
    await seedItems(
      session,
      Array.from({ length: 4 }, (_, index) => ({
        kind: "note",
        title: `Loose ${index + 1}`,
        collection_id: collectionId,
      })),
    );
    expect((await fetchCanvasRows(session, collectionId)).every((r) => r.canvas_x === null)).toBe(
      true,
    );

    const requests: string[] = [];
    page.on("request", (request) => {
      if (isLayoutRpc(request.url())) requests.push(request.url());
    });
    await openCanvas(page, `/app/c/${collectionId}`);
    await expect(page.locator(".react-flow__node")).toHaveCount(4);

    await expect
      .poll(async () =>
        (await fetchCanvasRows(session, collectionId)).every(
          (row) => row.canvas_x !== null && row.canvas_y !== null,
        ),
      )
      .toBe(true);
    expect(requests).toHaveLength(1);

    // A reload shows them where they were put, with no further saving needed.
    const placed = await nodeFlowPosition(
      page,
      (await fetchCanvasRows(session, collectionId))[0]!.id,
    );
    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    const again = await nodeFlowPosition(
      page,
      (await fetchCanvasRows(session, collectionId))[0]!.id,
    );
    expect(again.x).toBeCloseTo(placed.x, 0);
    expect(again.y).toBeCloseTo(placed.y, 0);
  });

  test("a failed save moves the node back and shows an error toast", async ({ page, context }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      // The 500 below is the point of the test; anything else is a real error.
      if (message.type() === "error" && !/status of 500/.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await startGuest(page);
    const session = await readSession(context);
    const collectionId = await createCollection(session, "Failing", "💥");
    const items = await seedPlaced(session, collectionId);
    const target = items[0];
    if (!target) throw new Error("No seeded item.");

    await openCanvas(page, `/app/c/${collectionId}`);
    await page.route("**/rest/v1/rpc/save_canvas_layout", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
    );
    const before = await nodeFlowPosition(page, target.id);

    const failed = page.waitForResponse((response) => isLayoutRpc(response.url()));
    await dragNode(page, target.id, 80, 50);
    expect((await nodeFlowPosition(page, target.id)).x).toBeGreaterThan(before.x + 30);
    await failed;

    await expect(page.getByText("Couldn't save the canvas layout.")).toBeVisible();
    await expect
      .poll(async () => (await nodeFlowPosition(page, target.id)).x)
      .toBeCloseTo(before.x, 0);
    expect((await nodeFlowPosition(page, target.id)).y).toBeCloseTo(before.y, 0);

    // The server never saw the move.
    const row = (await fetchCanvasRows(session, collectionId)).find((r) => r.id === target.id);
    expect(row?.canvas_x).toBe(0);
    expect(errors).toEqual([]);
  });
});
