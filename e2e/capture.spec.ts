import { type Locator, type Page, type Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { trackConsoleErrors } from "./helpers";
import { startGuest } from "./helpers/session";

// WP 3.5: paste, external drop and quick add, end to end against the local stack. This container
// has no outbound DNS, so /api/unfurl and the remote thumbnail host are mocked with page.route.

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const BLOG_URL = "https://blog.example.com/posts/hello-world";
const QUICK_URL = "https://news.example.com/story/42";
const IMAGE_HOST = "https://img.example.test";

/** A 1x1 transparent PNG, served for the mocked remote thumbnails. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

type UnfurlFixture = {
  title: string;
  isArticle?: boolean;
  provider?: "youtube" | null;
  imageUrl?: string | null;
};

function unfurlBody(url: string, fixture: UnfurlFixture) {
  return {
    url,
    finalUrl: url,
    canonicalUrl: null,
    title: fixture.title,
    description: "Mocked description",
    siteName: "Example",
    imageUrl: fixture.imageUrl ?? null,
    faviconUrl: null,
    isArticle: fixture.isArticle ?? false,
    provider: fixture.provider ?? null,
    metadata: {},
  };
}

const FIXTURES: Record<string, UnfurlFixture> = {
  [YOUTUBE_URL]: {
    title: "Mocked video title",
    provider: "youtube",
    imageUrl: `${IMAGE_HOST}/thumb.png`,
  },
  [BLOG_URL]: { title: "Mocked blog post", isArticle: true },
  [QUICK_URL]: { title: "Mocked news story", isArticle: true },
};

/** Answers /api/unfurl from the fixtures, and the mocked image host with a pixel. */
async function mockNetwork(page: Page) {
  await page.route(`${IMAGE_HOST}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL_PNG }),
  );
  await page.route("**/api/unfurl", async (route: Route) => {
    const { url } = route.request().postDataJSON() as { url: string };
    const fixture = FIXTURES[url];
    if (!fixture) return route.fulfill({ status: 502, json: { error: "unreachable" } });
    return route.fulfill({ status: 200, json: unfurlBody(url, fixture) });
  });
}

/** A valid one-page PDF, built with correct xref offsets. */
function samplePdf(): number[] {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
    "<< /Length 38 >>\nstream\n0.9 0.2 0.4 rg 20 20 160 160 re f\nendstream",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Array.from(Buffer.from(body, "latin1"));
}

function tiles(page: Page) {
  return page.locator('[data-slot="item-tile"]');
}

/** The card holding `text`; `kind` is the badge label. */
function card(page: Page, kind: string, text: string | RegExp): Locator {
  return tiles(page).filter({ hasText: kind }).filter({ hasText: text });
}

async function pasteText(page: Page, text: string) {
  await page.evaluate((value) => {
    (document.activeElement as HTMLElement | null)?.blur();
    const data = new DataTransfer();
    data.setData("text/plain", value);
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

/** Pastes a PNG built in the page, as a screenshot on the clipboard would arrive. */
async function pasteImage(page: Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#3366cc";
      context.fillRect(0, 0, 64, 48);
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("no blob"))),
        "image/png",
      ),
    );
    const data = new DataTransfer();
    data.items.add(new File([blob], "image.png", { type: "image/png" }));
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
}

/** Fires native drag events at the page with a PDF in the transfer. */
async function dragPdf(page: Page, phase: "enter" | "drop", bytes: number[]) {
  await page.evaluate(
    ([name, content, type]) => {
      const data = new DataTransfer();
      data.items.add(
        new File([new Uint8Array(content as number[])], name as string, {
          type: "application/pdf",
        }),
      );
      document.body.dispatchEvent(
        new DragEvent(type as string, { dataTransfer: data, bubbles: true, cancelable: true }),
      );
    },
    ["sample.pdf", bytes, phase === "enter" ? "dragenter" : "drop"] as const,
  );
}

test.describe("capture", () => {
  test("paste, drop and quick add save cards that survive a reload", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await mockNetwork(page);
    await startGuest(page);
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();

    // A YouTube URL becomes a Video card and is enriched in place.
    await pasteText(page, YOUTUBE_URL);
    const video = card(page, "Video", "Mocked video title");
    await expect(video).toBeVisible({ timeout: 3_000 });
    await expect(video).toHaveAttribute("data-enrich-status", "done");
    await expect(video.locator("img")).toBeVisible();

    // A blog URL becomes an Article.
    await pasteText(page, BLOG_URL);
    await expect(card(page, "Article", "Mocked blog post")).toBeVisible({ timeout: 3_000 });

    // Plain text becomes a Note.
    await pasteText(page, "Remember the milk");
    await expect(card(page, "Note", "Remember the milk")).toBeVisible();

    // A screenshot on the clipboard becomes an Image with a stored thumbnail.
    await pasteImage(page);
    const image = card(page, "Image", "image");
    await expect(image).toHaveAttribute("data-enrich-status", "done", { timeout: 15_000 });
    await expect(image.locator("img")).toBeVisible();

    // A PDF dropped from the OS: the overlay shows on dragenter, then a PDF card with a preview.
    const pdf = samplePdf();
    await dragPdf(page, "enter", pdf);
    await expect(page.locator('[data-slot="drop-overlay"]')).toBeVisible();
    await expect(page.locator('[data-slot="drop-overlay"]')).toContainText("Drop to save");
    await dragPdf(page, "drop", pdf);
    await expect(page.locator('[data-slot="drop-overlay"]')).toHaveCount(0);
    const pdfCard = card(page, "PDF", "sample");
    await expect(pdfCard).toHaveAttribute("data-enrich-status", "done", { timeout: 20_000 });
    await expect(pdfCard.locator("img")).toBeVisible();

    // Quick add: a URL, then a note.
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Link or note" }).fill(QUICK_URL);
    await dialog.getByRole("textbox", { name: "Link or note" }).press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeFocused();
    await expect(card(page, "Article", "Mocked news story")).toBeVisible({ timeout: 3_000 });

    await page.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Link or note" }).fill("A quick note");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, "Note", "A quick note")).toBeVisible();

    // Everything is stored: same cards, same kinds after a reload.
    await expect(tiles(page)).toHaveCount(7);
    await page.reload();
    await expect(tiles(page)).toHaveCount(7);
    await expect(card(page, "Video", "Mocked video title")).toBeVisible();
    await expect(card(page, "Article", "Mocked blog post")).toBeVisible();
    await expect(card(page, "Article", "Mocked news story")).toBeVisible();
    await expect(card(page, "Note", "Remember the milk")).toBeVisible();
    await expect(card(page, "Note", "A quick note")).toBeVisible();
    await expect(card(page, "Image", "image")).toBeVisible();
    await expect(card(page, "PDF", "sample")).toBeVisible();

    consoleErrors.assertNone();
  });

  test("a paste into a text field is left alone", async ({ page }) => {
    await mockNetwork(page);
    await startGuest(page);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const field = page.getByRole("textbox", { name: "Link or note" });
    await field.focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData("text/plain", "pasted into the field");
      document.activeElement?.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      );
    });
    await page.keyboard.press("Escape");
    await expect(tiles(page)).toHaveCount(0);
  });

  test("a failed unfurl shows Retry, and retrying enriches the card", async ({ page }) => {
    await mockNetwork(page);
    await startGuest(page);

    // Override the mock: this URL is unreachable at first.
    const flaky = "https://flaky.example.com/page";
    let fail = true;
    await page.route("**/api/unfurl", async (route) => {
      const { url } = route.request().postDataJSON() as { url: string };
      if (url !== flaky) return route.fallback();
      if (fail) return route.fulfill({ status: 502, json: { error: "unreachable" } });
      return route.fulfill({
        status: 200,
        json: unfurlBody(url, { title: "Back from the dead", isArticle: true }),
      });
    });

    await pasteText(page, flaky);
    const failed = tiles(page).filter({ hasText: flaky });
    await expect(failed).toHaveAttribute("data-enrich-status", "failed", { timeout: 5_000 });
    await expect(failed.getByText("Couldn't fetch details")).toBeVisible();

    fail = false;
    await failed.getByRole("button", { name: "Retry" }).click();
    const recovered = card(page, "Article", "Back from the dead");
    await expect(recovered).toBeVisible({ timeout: 5_000 });
    await expect(recovered).toHaveAttribute("data-enrich-status", "done");
  });
});
