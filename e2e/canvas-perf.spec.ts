import { expect, test } from "@playwright/test";
import { createCollection, readSession, seedCanvasItems, startGuest } from "./helpers/session";

const COUNT = 300;

// Gate check (Phase 6): pan and zoom a 300-card canvas and record frame intervals in the page.
test.skip(!process.env.CANVAS_PERF, "Run with CANVAS_PERF=1 at the phase gate.");

test("300 cards pan and zoom smoothly", async ({ page, context }) => {
  test.setTimeout(240_000);
  await startGuest(page);
  const session = await readSession(context);
  const collectionId = await createCollection(session, "Perf", "⚡");
  await seedCanvasItems(session, COUNT, { collectionId });
  await page.goto(`/app/c/${collectionId}`);
  const toggle = page.getByRole("button", { name: "Canvas view" });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await expect(page.locator(".react-flow__node")).toHaveCount(COUNT);
  await page.waitForTimeout(1500);

  const box = await page.locator(".react-flow").boundingBox();
  if (!box) throw new Error("Canvas has no box.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    let last = performance.now();
    const tick = (now: number) => {
      w.__frames.push(now - last);
      last = now;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 60; i += 1) {
    await page.mouse.wheel(i % 20 < 10 ? 40 : -40, 25);
    await page.waitForTimeout(16);
  }
  await page.keyboard.down("Control");
  for (let i = 0; i < 30; i += 1) {
    await page.mouse.wheel(0, i < 15 ? -60 : 60);
    await page.waitForTimeout(16);
  }
  await page.keyboard.up("Control");
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames.slice(2);
  });
  const sorted = [...frames].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const stats = {
    frames: frames.length,
    median: pct(0.5),
    p95: pct(0.95),
    max: sorted.at(-1),
    over50: frames.filter((f) => f > 50).length,
    fps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
  };
  console.log("CANVAS_PERF", JSON.stringify(stats));
  expect(stats.median).toBeLessThanOrEqual(17.5);
});
