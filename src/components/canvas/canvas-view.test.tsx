import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { makeItem, renderWithQuery } from "@/test/fixtures";
import { CanvasView } from "./canvas-view";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

// React Flow measures with these; jsdom has neither.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m22 = 1;
      constructor() {}
    },
  );
});

const items = [
  makeItem({ id: "a", kind: "note", title: "Sticky", canvas_x: 0, canvas_y: 0 }),
  makeItem({
    id: "b",
    kind: "link",
    title: "A link",
    url: "https://example.com",
    domain: "example.com",
  }),
];

describe("CanvasView", () => {
  it("renders every item as a node", () => {
    const { container } = renderWithQuery(<CanvasView items={items} />);
    expect(screen.getByRole("region", { name: "Canvas" })).toBeInTheDocument();
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Open Sticky" })).toBeInTheDocument();
  });

  it("opens an item when its card is clicked", () => {
    const onOpen = vi.fn();
    renderWithQuery(<CanvasView items={items} onOpen={onOpen} />);
    // fireEvent: user-event's mousedown has no `view`, which React Flow's drag handler needs.
    fireEvent.click(screen.getByRole("button", { name: "Open A link" }));
    expect(onOpen).toHaveBeenCalledWith(items[1]);
  });

  it("adds and drops nodes when the items change", () => {
    const { container, rerender } = renderWithQuery(<CanvasView items={items} />);
    const extra = makeItem({ id: "c", title: "New one" });
    act(() => rerender(<CanvasView items={[...items, extra]} />));
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(3);
    act(() => rerender(<CanvasView items={[extra]} />));
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(1);
  });

  it("toggles the minimap from the controls", async () => {
    const { container } = renderWithQuery(<CanvasView items={items} />);
    expect(container.querySelector(".react-flow__minimap")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show minimap" }));
    expect(container.querySelector(".react-flow__minimap")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Hide minimap" }));
  });
});
