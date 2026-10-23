import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { PdfPages } from "./pdf-pages";

const getDocument = vi.fn();
vi.mock("@/lib/items/pdfjs", () => ({ getPdfjs: () => ({ getDocument }) }));

const destroy = vi.fn(() => Promise.resolve());

function fakeDoc(numPages: number) {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 140 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
  };
  return { numPages, getPage: () => Promise.resolve(page) };
}

function wrap() {
  return render(
    <I18nProvider locale="en">
      <PdfPages src="https://signed.example/a.pdf" />
    </I18nProvider>,
  );
}

describe("PdfPages", () => {
  beforeEach(() => {
    getDocument.mockReset();
    destroy.mockClear();
  });

  it("renders one labelled canvas per page and destroys the task on unmount", async () => {
    getDocument.mockReturnValue({ promise: Promise.resolve(fakeDoc(3)), destroy });
    const view = wrap();
    expect(await screen.findByRole("img", { name: "Page 3 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Page 1 of 3" })).toBeInTheDocument();
    expect(getDocument).toHaveBeenCalledWith({ url: "https://signed.example/a.pdf" });
    view.unmount();
    expect(destroy).toHaveBeenCalled();
  });

  it("shows the failure copy and a link out when the PDF cannot load", async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error("bad")), destroy });
    wrap();
    expect(await screen.findByText("Couldn't load that file.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in new tab" })).toHaveAttribute(
      "href",
      "https://signed.example/a.pdf",
    );
  });
});
