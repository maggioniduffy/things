import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import type { ItemActions } from "@/lib/items/state-mutations";
import { ItemPreview } from "./previews";

const mocks = vi.hoisted(() => ({ phone: false }));

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => mocks.phone }));
vi.mock("@/hooks/use-signed-urls", () => ({
  useSignedUrls: (paths: (string | null)[]) =>
    new Map(paths.filter(Boolean).map((p) => [p as string, `https://signed.example/${p}`])),
}));
vi.mock("./pdf-pages", () => ({
  PHONE_PDF_QUERY: "phone",
  PdfPages: ({ src }: { src: string }) => <div data-testid="pdf-pages" data-src={src} />,
}));

function renderPdf() {
  const item = makeItem({
    kind: "pdf",
    title: "Paper",
    file_path: "u/i/p.pdf",
    enrich_status: "done",
  });
  return render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <I18nProvider locale="en">
        <ItemPreview item={item} actions={{} as ItemActions} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("PDF preview", () => {
  beforeEach(() => {
    mocks.phone = false;
  });

  it("keeps the native iframe on desktop", () => {
    renderPdf();
    expect(screen.getByTitle("PDF: Paper").tagName).toBe("IFRAME");
    expect(screen.queryByTestId("pdf-pages")).toBeNull();
  });

  it("renders pdf.js pages instead of the iframe on phones", () => {
    mocks.phone = true;
    renderPdf();
    expect(screen.getByTestId("pdf-pages")).toHaveAttribute(
      "data-src",
      "https://signed.example/u/i/p.pdf",
    );
    expect(document.querySelector("iframe")).toBeNull();
  });
});
