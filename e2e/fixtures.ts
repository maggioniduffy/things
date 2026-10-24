import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

/** The tour's first step, in either language. */
export const TOUR_WELCOME = /^(Welcome to|Te damos la bienvenida a) /;

/**
 * `test` for every spec except onboarding.spec.ts: a new account opens the first-visit tour, a
 * blocking dialog, wherever it first lands in /app. This skips it whenever it shows, so specs
 * act on the app as before. onboarding.spec.ts imports @playwright/test directly to see it.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addLocatorHandler(page.getByRole("dialog", { name: TOUR_WELCOME }), async (tour) => {
      await tour.getByRole("button", { name: /^(Skip|Omitir)$/ }).click();
    });
    await provide(page);
  },
});
