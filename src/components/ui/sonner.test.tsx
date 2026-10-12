import { beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: vi.fn(() => "toast-id") }));

vi.mock("sonner", () => ({
  toast,
  Toaster: () => null,
}));

import { undoToast } from "./sonner";

describe("undoToast", () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it("shows the message with a 5 second Undo action", () => {
    undoToast("Moved to trash", () => {});
    expect(toast).toHaveBeenCalledTimes(1);
    const [message, options] = toast.mock.calls[0] as unknown as [
      string,
      { duration: number; action: { label: string; onClick: (event: MouseEvent) => void } },
    ];
    expect(message).toBe("Moved to trash");
    expect(options.duration).toBe(5000);
    expect(options.action.label).toBe("Undo");
  });

  it("calls onUndo when the action fires", () => {
    const onUndo = vi.fn();
    undoToast("Moved to trash", onUndo);
    const [, options] = toast.mock.calls[0] as unknown as [
      string,
      { action: { onClick: (event: MouseEvent) => void } },
    ];
    expect(onUndo).not.toHaveBeenCalled();
    options.action.onClick(new MouseEvent("click"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
