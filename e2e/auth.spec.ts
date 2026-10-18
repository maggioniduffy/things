import { expect, test, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";
import { accountGroup } from "./helpers/session";
import { getOtpCode, uniqueEmail } from "./mailpit";

/** Walks the two-step form: email, code from the local mail catcher, verify. */
async function signInWithEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();

  const codeField = page.getByLabel(/Enter the 6-digit code we sent to/);
  await expect(codeField).toBeVisible();
  await expect(codeField).toBeFocused();

  const code = await getOtpCode(email);
  await codeField.fill(code); // six digits submit automatically
}

test.describe("email code sign-in", () => {
  test("signs in, survives a reload, signs out and is locked out again", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    const email = uniqueEmail();

    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Things" })).toBeVisible();
    await signInWithEmail(page, email);

    await expect(page).toHaveURL(/\/app$/);
    await expect(accountGroup(page)).toContainText(email);

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(accountGroup(page)).toContainText(email);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    consoleErrors.assertNone();
  });

  test("honors next after signing in", async ({ page }) => {
    const collection = "/app/c/6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";
    await page.goto(collection);
    await expect(page).toHaveURL(
      /\/login\?next=%2Fapp%2Fc%2F6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f$/,
    );

    await signInWithEmail(page, uniqueEmail());

    // The collection does not exist (a "not found" board), but the URL is where we were headed.
    await expect(page).toHaveURL(new RegExp(`${collection}$`));
  });

  test("a wrong code shows an inline error and stays on the code step", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send code" }).click();

    const codeField = page.getByLabel(/Enter the 6-digit code we sent to/);
    await expect(codeField).toBeVisible();
    // Make sure the real code exists, then submit a different one.
    const real = await getOtpCode(email);
    const wrong = real === "000000" ? "111111" : "000000";
    await codeField.fill(wrong);

    await expect(
      page.getByRole("alert").filter({ hasText: "That code didn't work" }),
    ).toBeVisible();
    await expect(codeField).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a different email returns to the first step", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByLabel(/Enter the 6-digit code we sent to/)).toBeVisible();

    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  });

  test("does not offer Google while it is not configured", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  });
});

test.describe("guest and redirects", () => {
  test("starts a guest session from the landing page", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto("/");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Try without an account" })
      .first()
      .click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(accountGroup(page)).toContainText("Guest");

    // A guest may still open /login to sign in to a real account.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Things" })).toBeVisible();

    // And "Try without an account" with an existing session just goes back to the app.
    await page.getByRole("button", { name: "Try without an account" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(accountGroup(page)).toContainText("Guest");

    // A returning guest stays on the landing page and gets "Open app" buttons.
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("banner").getByRole("link", { name: "Open app" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Open app" }).first().click();
    await expect(page).toHaveURL(/\/app$/);
    consoleErrors.assertNone();
  });

  test("starts a guest session from the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Try without an account" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(accountGroup(page)).toContainText("Guest");
  });

  test("redirects a signed-in user away from /login and the landing page", async ({ page }) => {
    await page.goto("/login");
    await signInWithEmail(page, uniqueEmail());
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("shows a message when the OAuth callback fails", async ({ page }) => {
    await page.goto(
      "/auth/callback?error=access_denied&error_description=nope&next=%2Fapp%2Fc%2Fabc",
    );
    await expect(page).toHaveURL(/\/login\?error=callback&next=%2Fapp%2Fc%2Fabc$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "couldn't finish signing you in" }),
    ).toBeVisible();
  });

  test("explains a Google account that already belongs to another user", async ({ page }) => {
    await page.goto(
      "/auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user",
    );
    await expect(page).toHaveURL(/\/login\?error=callback&reason=account_exists$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "already has a Things account" }),
    ).toBeVisible();
  });

  test("ignores an unsafe next on the callback", async ({ page }) => {
    await page.goto("/auth/callback?code=bogus&next=%2F%2Fevil.example");
    await expect(page).toHaveURL(/\/login\?error=callback$/);
    // A tab is stripped by URL parsers, so "/\t/evil" would become "//evil" (open redirect).
    await page.goto("/auth/callback?code=bogus&next=%2F%09%2Fevil.example");
    await expect(page).toHaveURL(/\/login\?error=callback$/);
  });

  test("never leaves the site after sign-in, even with a control character in next", async ({
    page,
  }) => {
    await page.goto("/login?next=%2F%09%2Fevil.example%2Fphish");
    await signInWithEmail(page, uniqueEmail());
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/app$/);
  });
});
