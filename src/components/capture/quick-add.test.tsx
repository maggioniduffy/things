import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import type { ViewSpec } from "@/lib/views";
import { QuickAdd } from "./quick-add";

const capture = vi.hoisted(() => ({
  captureLink: vi.fn(async () => {}),
  captureNote: vi.fn(async () => {}),
  captureFile: vi.fn(async () => {}),
}));
vi.mock("@/lib/items/mutations", () => ({ useCapture: () => capture }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const VIEW: ViewSpec = { type: "inbox" };

function renderOpen() {
  useUiStore.setState({ quickAddOpen: true });
  return render(<QuickAdd view={VIEW} />);
}

const field = () => screen.getByRole("textbox", { name: "Link or note" });
const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("QuickAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ quickAddOpen: false });
  });

  it("renders nothing while closed", () => {
    render(<QuickAdd view={VIEW} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a dialog titled Add with a focused field, helper text and both buttons", () => {
    renderOpen();
    expect(screen.getByRole("dialog", { name: "Add" })).toBeInTheDocument();
    expect(field()).toHaveAttribute("placeholder", "Paste a link or write a note");
    expect(field()).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveTextContent("Enter to save, Shift + Enter");
    expect(screen.getByRole("button", { name: "Choose files" })).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute("data-variant", "primary");
  });

  it("disables Save until there is text", async () => {
    renderOpen();
    expect(saveButton()).toBeDisabled();
    await userEvent.type(field(), "   ");
    expect(saveButton()).toBeDisabled();
    await userEvent.type(field(), "hi");
    expect(saveButton()).toBeEnabled();
  });

  it("saves a URL as a link on Enter and closes", async () => {
    renderOpen();
    await userEvent.type(field(), "https://example.com/post{Enter}");
    expect(capture.captureLink).toHaveBeenCalledWith("https://example.com/post");
    expect(useUiStore.getState().quickAddOpen).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("saves text as a note with the Save button", async () => {
    renderOpen();
    await userEvent.type(field(), "Remember this");
    await userEvent.click(saveButton());
    expect(capture.captureNote).toHaveBeenCalledWith("Remember this");
    expect(useUiStore.getState().quickAddOpen).toBe(false);
  });

  it("inserts a newline on Shift+Enter instead of saving", async () => {
    renderOpen();
    await userEvent.type(field(), "line one{Shift>}{Enter}{/Shift}line two");
    expect(capture.captureNote).not.toHaveBeenCalled();
    expect(field()).toHaveValue("line one\nline two");
    await userEvent.click(saveButton());
    expect(capture.captureNote).toHaveBeenCalledWith("line one\nline two");
  });

  it("does not save on Enter while an IME is composing", async () => {
    renderOpen();
    await userEvent.type(field(), "ni");
    const textarea = field();
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    textarea.dispatchEvent(event);
    expect(capture.captureNote).not.toHaveBeenCalled();
    expect(useUiStore.getState().quickAddOpen).toBe(true);
  });

  it("splits several pasted URLs into links", async () => {
    renderOpen();
    await userEvent.click(field());
    await userEvent.paste("https://a.example/\nhttps://b.example/");
    await userEvent.click(saveButton());
    expect(capture.captureLink).toHaveBeenCalledTimes(2);
  });

  it("saves chosen files at once and closes", async () => {
    renderOpen();
    const input = screen.getByTestId("quick-add-files") as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");
    const a = new File(["a"], "a.pdf", { type: "application/pdf" });
    const b = new File(["b"], "b.png", { type: "image/png" });
    await userEvent.upload(input, [a, b]);
    expect(capture.captureFile).toHaveBeenCalledTimes(2);
    expect(capture.captureFile).toHaveBeenCalledWith(a);
    expect(capture.captureFile).toHaveBeenCalledWith(b);
    expect(useUiStore.getState().quickAddOpen).toBe(false);
  });

  it("opens the file picker from the Choose files button", async () => {
    renderOpen();
    const input = screen.getByTestId("quick-add-files") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    await userEvent.click(screen.getByRole("button", { name: "Choose files" }));
    expect(click).toHaveBeenCalled();
  });

  it("captures a file pasted into the field without inserting text", async () => {
    renderOpen();
    const image = new File(["png"], "image.png", { type: "image/png" });
    await userEvent.click(field());
    await userEvent.paste({
      files: [image],
      getData: () => "",
      types: ["Files"],
    } as unknown as DataTransfer);
    expect(capture.captureFile).toHaveBeenCalledWith(image);
    expect(useUiStore.getState().quickAddOpen).toBe(false);
  });

  it("returns focus to the element that had it before opening", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.append(opener);
    opener.focus();
    useUiStore.setState({ quickAddOpen: true });
    render(<QuickAdd view={VIEW} />);
    await waitFor(() => expect(field()).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it("starts empty the next time it opens", async () => {
    renderOpen();
    await userEvent.type(field(), "draft");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    useUiStore.getState().setQuickAddOpen(true);
    expect(await screen.findByRole("textbox", { name: "Link or note" })).toHaveValue("");
  });
});
