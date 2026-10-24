import { expect, test } from "./fixtures";
import { createNotes, readSession, startGuest } from "./helpers/session";

test("signing out and starting a new guest never shows the previous account's items", async ({
  page,
  context,
}) => {
  await startGuest(page);
  const first = await readSession(context);
  await createNotes(first, 3, "Private A");
  await page.reload();
  await expect(page.getByText("Private A 1", { exact: true })).toBeVisible();

  // Record every moment the old account's items are in the DOM, across client navigations.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    new MutationObserver(() => {
      if (document.body.innerText.includes("Private A")) seen.push(location.pathname);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => {
    (window as unknown as { __seen: string[] }).__seen.length = 0;
  });

  await page
    .getByRole("main")
    .getByRole("button", { name: "Try without an account" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 2, name: "Drop anything here." })).toBeVisible();
  expect((await readSession(context)).user.id).not.toBe(first.user.id);

  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  expect(seen).toEqual([]);
});
