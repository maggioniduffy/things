import { expect, type Page } from "@playwright/test";

/** Collects console errors and page errors; call `assertNone()` at the end of a test. */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { assertNone: () => expect(errors).toEqual([]) };
}
