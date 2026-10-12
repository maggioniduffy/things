import { expect, test, type Page } from "@playwright/test";
import { clearMail } from "./helpers/mail";
import {
  accountGroup,
  createNotes,
  fetchAuthUser,
  guestBanner,
  listItemTitles,
  readSession,
  startGuest,
} from "./helpers/session";
import { getOtpCode, uniqueEmail } from "./mailpit";

const BANNER_COPY = "You're using Things as a guest. Add an email to keep your things.";
const CONFLICT_COPY =
  "That email already has a Things account. Sign in to it instead — items saved as a guest won't move over yet.";

/** Opens the upgrade dialog from the banner and requests a code for `email`. */
async function requestUpgradeCode(page: Page, email: string) {
  await page.getByRole("button", { name: "Keep my things" }).click();
  // Not matched by name: the title changes from "Keep your things" to "Check your email".
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Keep your things" })).toBeVisible();
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Send code" }).click();
  return dialog;
}

/** Signs in through /login with the email code (an existing or new account). */
async function signInWithEmail(page: Page, email: string) {
  await clearMail(email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  const codeField = page.getByLabel(/Enter the 6-digit code we sent to/);
  await expect(codeField).toBeVisible();
  await codeField.fill(await getOtpCode(email));
  await expect(page).toHaveURL(/\/app$/);
}

test.describe("guest banner and upgrade", () => {
  test("a guest adds an email and keeps every item under the same user id", async ({
    page,
    context,
  }) => {
    const email = uniqueEmail("keep");

    await startGuest(page);
    await expect(guestBanner(page)).toContainText(BANNER_COPY);

    // Two items saved as the guest, through the session the app itself holds.
    const guest = await readSession(context);
    expect(guest.user.is_anonymous).toBe(true);
    await createNotes(guest, 2, "Kept");
    expect(await listItemTitles(guest)).toEqual(["Kept 1", "Kept 2"]);

    // Upgrade with an email code.
    await clearMail(email);
    const dialog = await requestUpgradeCode(page, email);
    const codeField = dialog.getByLabel(/Enter the 6-digit code we sent to/);
    await expect(codeField).toBeVisible();
    await expect(codeField).toBeFocused();
    await codeField.fill(await getOtpCode(email)); // six digits submit automatically

    await expect(page.getByText(`Your things are saved to ${email}.`)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(guestBanner(page)).toHaveCount(0);
    await expect(accountGroup(page)).toContainText(email);

    // Same user id, no longer anonymous, and every item is still there.
    const upgraded = await readSession(context);
    expect(upgraded.user.id).toBe(guest.user.id);
    expect(upgraded.user.is_anonymous).toBe(false);
    expect(upgraded.user.email).toBe(email);
    const serverUser = await fetchAuthUser(upgraded);
    expect(serverUser).toMatchObject({ id: guest.user.id, email, is_anonymous: false });
    expect(await listItemTitles(upgraded)).toEqual(["Kept 1", "Kept 2"]);

    // The page is interactive again (the dialog left no scroll lock behind), and stays upgraded.
    await page.reload();
    await expect(accountGroup(page)).toContainText(email);
    await expect(guestBanner(page)).toHaveCount(0);

    // Sign out, then back in with the same email: the items come with the account.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await signInWithEmail(page, email);
    await expect(accountGroup(page)).toContainText(email);
    await expect(guestBanner(page)).toHaveCount(0);

    const returning = await readSession(context);
    expect(returning.user.id).toBe(guest.user.id);
    expect(await listItemTitles(returning)).toEqual(["Kept 1", "Kept 2"]);
  });

  test("a wrong code stays on the code step with an inline error", async ({ page }) => {
    const email = uniqueEmail("wrong");
    await startGuest(page);
    await clearMail(email);
    const dialog = await requestUpgradeCode(page, email);
    const codeField = dialog.getByLabel(/Enter the 6-digit code we sent to/);
    await expect(codeField).toBeVisible();

    const real = await getOtpCode(email);
    await codeField.fill(real === "000000" ? "111111" : "000000");

    await expect(
      dialog.getByRole("alert").filter({ hasText: "That code didn't work" }),
    ).toBeVisible();
    await expect(codeField).toBeVisible();
  });

  test("an email that already has an account shows the sign-in message", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("taken");

    // An existing account for that email.
    const owner = await browser.newContext();
    const ownerPage = await owner.newPage();
    await signInWithEmail(ownerPage, email);
    await owner.close();

    // A second guest tries to claim it.
    await startGuest(page);
    const dialog = await requestUpgradeCode(page, email);
    await expect(dialog.getByText(CONFLICT_COPY)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Send code" })).toBeEnabled();

    // "Sign in instead" leaves the guest session and opens the login page.
    await dialog.getByRole("button", { name: "Sign in instead" }).click();
    await expect(page).toHaveURL(/\/login\?next=\/app$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Things" })).toBeVisible();
  });

  test("a guest with 10 items sees the stronger reminder", async ({ page, context }) => {
    await startGuest(page);
    await createNotes(await readSession(context), 10, "Many");

    await page.reload();
    await expect(guestBanner(page)).toContainText(
      "You've saved 10 things as a guest. Add an email so you don't lose them.",
    );
  });

  test("dismissing hides the banner for this tab only", async ({ page, context }) => {
    await startGuest(page);
    await page.getByRole("button", { name: "Dismiss for now" }).click();
    await expect(guestBanner(page)).toHaveCount(0);

    // Reload in the same tab: still hidden. Open and close quick add first, which only works once
    // the page has hydrated, so the check cannot pass on the server-rendered (hidden) banner.
    await page.reload();
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Add" })).toHaveCount(0);
    await expect(accountGroup(page)).toContainText("Guest");
    await expect(guestBanner(page)).toHaveCount(0);

    // A new tab is a new visit: the banner is back.
    const second = await context.newPage();
    await second.goto("/app");
    await expect(guestBanner(second)).toBeVisible();
  });
});
