import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { createCollection, readSession, startGuest } from "./helpers/session";

test.describe("empty view add card", () => {
  test("an empty collection offers the card and the note lands in that collection", async ({
    page,
    context,
  }) => {
    const errors = trackConsoleErrors(page);
    await startGuest(page);
    const session = await readSession(context);
    const id = await createCollection(session, "Ideas");

    await page.goto(`/app/c/${id}`);
    await page.getByRole("button", { name: /Add something/ }).click();
    await page.getByRole("textbox", { name: "Link or note" }).fill("Remember the milk");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.locator('[data-slot="item-tile"]')).toHaveCount(1);
    await expect(page.getByText("Remember the milk")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add something/ })).toHaveCount(0);

    // It is in the collection, not only in the inbox.
    await page.goto("/app");
    await expect(page.getByText("Remember the milk")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
