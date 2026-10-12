import { expect, test } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";

test.describe("landing page", () => {
  test("has the title, headline and both CTAs", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto("/");

    await expect(page).toHaveTitle("Things — save anything for later");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Save anything. Find it again.",
    );

    const main = page.getByRole("main");
    const guest = main.getByRole("button", { name: "Try without an account" });
    const signIn = main.getByRole("link", { name: "Sign in" });
    await expect(guest).toBeVisible();
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", /^\/login/);

    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Things on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/maggioniduffy/things",
    );
    consoleErrors.assertNone();
  });

  test("does not scroll horizontally on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("stops the aurora drift under reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    const animations = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-aurora], [data-aurora] *")).map((el) => {
        const style = getComputedStyle(el);
        return { name: style.animationName, duration: style.animationDuration };
      }),
    );
    expect(animations.length).toBeGreaterThan(5);
    for (const animation of animations) {
      expect(animation.name).toBe("none");
    }
    await context.close();
  });

  test("drifts when motion is allowed", async ({ page }) => {
    await page.goto("/");
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-aurora-blob]")).map(
        (el) => getComputedStyle(el).animationName,
      ),
    );
    expect(names.length).toBe(5);
    expect(names.every((name) => name.startsWith("aurora-drift"))).toBe(true);
  });
});
