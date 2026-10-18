import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KEYBOARD_SAVE_DELAY_MS, NoteColorPicker } from "./note-color-picker";

const LABELS = ["Default", "Pink", "Violet", "Blue", "Red", "Coral", "Olive", "White", "Graphite"];

describe("NoteColorPicker", () => {
  it("renders a radiogroup with Default and the eight colors, checking the current one", () => {
    render(<NoteColorPicker value="blue" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Color" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-label"))).toEqual(
      LABELS,
    );
    expect(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Pink" })).not.toBeChecked();
  });

  it("reads null and unknown values as Default", () => {
    const { rerender } = render(<NoteColorPicker value={null} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Default" })).toBeChecked();
    rerender(<NoteColorPicker value="magenta" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Default" })).toBeChecked();
  });

  it("saves a clicked color, and null for Default", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NoteColorPicker value="blue" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Graphite" }));
    expect(onChange).toHaveBeenLastCalledWith("graphite");
    await user.click(screen.getByRole("radio", { name: "Default" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("moves and selects with the arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<NoteColorPicker value="graphite" onChange={() => {}} />);
    screen.getByRole("radio", { name: "Graphite" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Default" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Default" })).toBeChecked();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Graphite" })).toBeChecked();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Default" })).toBeChecked();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Graphite" })).toBeChecked();
  });

  it("saves keyboard browsing once, after a pause", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<NoteColorPicker value={null} onChange={onChange} />);
      for (const name of ["Default", "Pink", "Violet"]) {
        fireEvent.keyDown(screen.getByRole("radio", { name }), { key: "ArrowRight" });
      }
      expect(onChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(KEYBOARD_SAVE_DELAY_MS));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("blue");
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves a pending keyboard pick on unmount", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<NoteColorPicker value={null} onChange={onChange} />);
    screen.getByRole("radio", { name: "Default" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).not.toHaveBeenCalled();
    unmount();
    expect(onChange).toHaveBeenCalledWith("graphite");
  });

  it("puts only the checked swatch in the tab order", () => {
    render(<NoteColorPicker value="red" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Red" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Pink" })).toHaveAttribute("tabindex", "-1");
  });
});
