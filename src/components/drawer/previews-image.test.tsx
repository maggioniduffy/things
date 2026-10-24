import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import type { ItemActions } from "@/lib/items/state-mutations";
import { ItemPreview } from "./previews";

const mocks = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.mock("@/hooks/use-signed-urls", () => ({
  useSignedUrls: (paths: (string | null)[]) =>
    new Map(paths.filter(Boolean).map((p) => [p as string, `https://signed.example/${p}`])),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) } }),
}));

function renderImage(overrides: Parameters<typeof makeItem>[0] = {}) {
  const item = makeItem({
    kind: "image",
    title: "Sunset",
    file_path: "u/i/sunset.jpg",
    file_name: "sunset.jpg",
    enrich_status: "done",
    ...overrides,
  });
  return render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <I18nProvider locale="en">
        <ItemPreview item={item} actions={{} as ItemActions} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("image full view", () => {
  beforeEach(() => {
    mocks.createSignedUrl.mockReset();
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/download" },
      error: null,
    });
  });

  it("opens full screen with the title, Download and Close; Close shuts it", async () => {
    const user = userEvent.setup();
    renderImage();
    await user.click(screen.getByRole("button", { name: "View full size" }));

    const viewer = screen.getByRole("dialog", { name: "Sunset" });
    expect(viewer.querySelector("img")).toHaveAttribute(
      "src",
      "https://signed.example/u/i/sunset.jpg",
    );
    expect(screen.getByRole("button", { name: "Download" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("downloads the stored file under its own name", async () => {
    const user = userEvent.setup();
    renderImage();
    await user.click(screen.getByRole("button", { name: "View full size" }));
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("u/i/sunset.jpg", 60, {
      download: "sunset.jpg",
    });
  });

  it("offers a remote image as a download link opening in a new tab", async () => {
    const user = userEvent.setup();
    renderImage({ file_path: null, file_name: null, image_url: "https://img.example/a.png" });
    await user.click(screen.getByRole("button", { name: "View full size" }));
    const link = screen.getByRole("link", { name: "Download" });
    expect(link).toHaveAttribute("href", "https://img.example/a.png");
    expect(link).toHaveAttribute("target", "_blank");
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    renderImage();
    await user.click(screen.getByRole("button", { name: "View full size" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
