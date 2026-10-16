import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import {
  createCollection,
  fetchCanvasRows,
  readSession,
  seedItems,
  startGuest,
  supabasePublicEnv,
  uploadBytes,
  type AppSession,
} from "./helpers/session";

test.describe.configure({ timeout: 120_000 });

const NOTE_W = 240;
const NOTE_H = 160;

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

async function showCanvas(page: Page) {
  const toggle = page.getByRole("button", { name: "Canvas view" });
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await expect(page.getByRole("region", { name: "Canvas" })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

/** Selects the cards with ids `ids` by drawing one marquee around all of them. */
async function marqueeSelect(page: Page, ids: string[]) {
  const boxes = await Promise.all(
    ids.map(async (id) => {
      const box = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
      if (!box) throw new Error("Node has no box.");
      return box;
    }),
  );
  const left = Math.min(...boxes.map((box) => box.x)) - 24;
  const top = Math.min(...boxes.map((box) => box.y)) - 24;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) - 4;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) - 4;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(ids.length);
}

async function emptyPoint(page: Page) {
  const box = await page.locator(".react-flow").boundingBox();
  if (!box) throw new Error("Canvas has no box.");
  return { x: Math.round(box.x + box.width * 0.5), y: Math.round(box.y + box.height * 0.6) };
}

function seedNotes(
  session: AppSession,
  titles: string[],
  collectionId: string | null,
  at: number[][],
) {
  return seedItems(
    session,
    titles.map((title, index) => ({
      kind: "note",
      title,
      // Valid fractional-indexing keys: a paste reserves keys before the first.
      position: `a${index}`,
      ...(collectionId ? { collection_id: collectionId } : {}),
      canvas_x: at[index]?.[0] ?? 0,
      canvas_y: at[index]?.[1] ?? 0,
    })),
  );
}

function authHeaders(session: AppSession) {
  return {
    apikey: supabasePublicEnv().publishableKey,
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

test.describe("canvas copy and paste", () => {
  test("copies three cards from the Inbox and pastes them at the cursor in a collection", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const targetId = await createCollection(session, "Target", "🎯");
    await seedNotes(session, ["Existing"], targetId, [[0, 0]]);
    const originals = await seedNotes(
      session,
      ["Alpha", "Beta", "Gamma", "Far one", "Far two"],
      null,
      [
        [0, 0],
        [320, 40],
        [120, 280],
        [1600, 0],
        [1600, 300],
      ],
    );
    const ids = originals.slice(0, 3).map((item) => item.id);

    await page.goto("/app");
    await showCanvas(page);
    await marqueeSelect(page, ids);
    await page.keyboard.press("ControlOrMeta+c");

    // Client-side navigation: a reload would empty the in-app clipboard.
    await page.getByRole("link", { name: /Target/ }).click();
    await expect(page).toHaveURL(new RegExp(`/app/c/${targetId}`));
    await showCanvas(page);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    const at = await emptyPoint(page);
    await page.mouse.move(at.x, at.y);
    await page.keyboard.press("ControlOrMeta+v");

    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(3);
    await expect.poll(async () => (await fetchCanvasRows(session, targetId)).length).toBe(4);

    const rows = (await fetchCanvasRows(session, targetId)).filter(
      (row) => row.title !== "Existing",
    );
    const byTitle = new Map(rows.map((row) => [row.title, row]));
    const [alpha, beta, gamma] = ["Alpha", "Beta", "Gamma"].map((title) => byTitle.get(title));
    if (
      alpha?.canvas_x == null ||
      alpha.canvas_y == null ||
      beta?.canvas_x == null ||
      beta.canvas_y == null ||
      gamma?.canvas_x == null ||
      gamma.canvas_y == null
    ) {
      throw new Error("A copy has no canvas position.");
    }
    // Same relative layout as the originals (0,0), (320,40), (120,280).
    expect(beta.canvas_x - alpha.canvas_x).toBeCloseTo(320, 0);
    expect(beta.canvas_y - alpha.canvas_y).toBeCloseTo(40, 0);
    expect(gamma.canvas_x - alpha.canvas_x).toBeCloseTo(120, 0);
    expect(gamma.canvas_y - alpha.canvas_y).toBeCloseTo(280, 0);

    // The bounding box of the copies is centered on the cursor (within the 8 px snap).
    const flow = await flowPointAt(page, at);
    const centerX = (alpha.canvas_x + beta.canvas_x + NOTE_W) / 2;
    const centerY = (alpha.canvas_y + gamma.canvas_y + NOTE_H) / 2;
    expect(Math.abs(centerX - flow.x)).toBeLessThanOrEqual(9);
    expect(Math.abs(centerY - flow.y)).toBeLessThanOrEqual(9);

    // The originals stay where they were, and Undo takes the copies away for good.
    expect((await fetchCanvasRows(session, null)).length).toBe(5);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await fetchCanvasRows(session, targetId)).length).toBe(1);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    errors.assertNone();
  });

  test("Cmd+D duplicates a card 16 px down and right", async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const [card] = await seedNotes(session, ["Solo"], null, [[100, 100]]);
    if (!card) throw new Error("No seed.");

    await page.goto("/app");
    await showCanvas(page);
    await marqueeSelect(page, [card.id]);
    await page.keyboard.press("ControlOrMeta+d");

    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect.poll(async () => (await fetchCanvasRows(session, null)).length).toBe(2);
    const rows = await fetchCanvasRows(session, null);
    const copy = rows.find((row) => row.id !== card.id);
    expect(copy?.canvas_x).toBeCloseTo(116, 0);
    expect(copy?.canvas_y).toBeCloseTo(116, 0);
    // The copy is the selection now, not the original.
    await expect(page.locator(`.react-flow__node.selected[data-id="${copy?.id}"]`)).toHaveCount(1);
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    errors.assertNone();
  });

  test("a copied file still opens after the original is trashed and deleted forever", async ({
    page,
    context,
  }) => {
    await startGuest(page);
    const session = await readSession(context);
    const path = `${session.user.id}/seed/doc.bin`;
    expect(await uploadBytes(session, "seed/doc.bin", 100)).toBe(200);
    const [file] = await seedItems(session, [
      {
        kind: "document",
        title: "Report",
        file_name: "doc.bin",
        file_path: path,
        mime_type: "application/octet-stream",
        file_size: 100,
        position: "a0",
        canvas_x: 0,
        canvas_y: 0,
      },
    ]);
    if (!file) throw new Error("No seed.");

    await page.goto("/app");
    await showCanvas(page);
    await marqueeSelect(page, [file.id]);
    await page.keyboard.press("ControlOrMeta+c");
    const at = await emptyPoint(page);
    await page.mouse.move(at.x, at.y);
    await page.keyboard.press("ControlOrMeta+v");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    const { url } = supabasePublicEnv();
    let copyPath = "";
    await expect
      .poll(async () => {
        const response = await fetch(`${url}/rest/v1/items?select=id,file_path&id=neq.${file.id}`, {
          headers: authHeaders(session),
        });
        const rows = (await response.json()) as { id: string; file_path: string | null }[];
        copyPath = rows[0]?.file_path ?? "";
        return copyPath;
      })
      .not.toBe("");
    expect(copyPath).not.toBe(path);

    // Trash the original, then delete it forever (objects first, then the row).
    const trashed = await fetch(`${url}/rest/v1/items?id=eq.${file.id}`, {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
    expect(trashed.status).toBeLessThan(300);
    const removed = await fetch(`${url}/storage/v1/object/things`, {
      method: "DELETE",
      headers: authHeaders(session),
      body: JSON.stringify({ prefixes: [path] }),
    });
    expect(removed.status).toBe(200);
    const deleted = await fetch(`${url}/rest/v1/items?id=eq.${file.id}`, {
      method: "DELETE",
      headers: authHeaders(session),
    });
    expect(deleted.status).toBeLessThan(300);

    const signed = await fetch(`${url}/storage/v1/object/sign/things/${copyPath}`, {
      method: "POST",
      headers: authHeaders(session),
      body: JSON.stringify({ expiresIn: 60 }),
    });
    expect(signed.status).toBe(200);
    const { signedURL } = (await signed.json()) as { signedURL: string };
    const download = await fetch(`${url}/storage/v1${signedURL}`);
    expect(download.status).toBe(200);
    expect((await download.arrayBuffer()).byteLength).toBe(100);
  });
});
