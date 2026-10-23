import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSwipeToClose } from "./use-swipe-to-close";

function Panel({ onClose, enabled = true }: { onClose: () => void; enabled?: boolean }) {
  const ref = useSwipeToClose({ enabled, onClose });
  return (
    <div ref={ref} data-testid="panel">
      <p data-testid="text">text</p>
      <textarea data-testid="field" />
    </div>
  );
}

function swipe(target: Element, from: [number, number], to: [number, number]) {
  const point = (p: [number, number]) => [{ clientX: p[0], clientY: p[1] }];
  fireEvent.touchStart(target, { touches: point(from) });
  fireEvent.touchMove(target, { touches: point(to) });
  fireEvent.touchEnd(target, { changedTouches: point(to), touches: [] });
}

describe("useSwipeToClose", () => {
  it("closes on a long horizontal swipe to the right", () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    swipe(screen.getByTestId("text"), [20, 100], [150, 110]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores vertical swipes, short swipes and swipes to the left", () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    const text = screen.getByTestId("text");
    swipe(text, [100, 50], [150, 300]);
    swipe(text, [20, 100], [50, 100]);
    swipe(text, [200, 100], [20, 100]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores swipes that start in a textarea", () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    swipe(screen.getByTestId("field"), [20, 100], [200, 100]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} enabled={false} />);
    swipe(screen.getByTestId("text"), [20, 100], [200, 100]);
    expect(onClose).not.toHaveBeenCalled();
  });
});
