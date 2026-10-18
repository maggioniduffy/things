import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuroraButton } from "./aurora-button";

describe("AuroraButton", () => {
  it("shows the label and no fill when idle", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <AuroraButton pending={false} pendingLabel="Sending…" onClick={onClick}>
        Send code
      </AuroraButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-slot="aurora-fill"]')).toBeNull();
  });

  it("fills, swaps the label and ignores clicks while pending, without dimming", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <AuroraButton pending pendingLabel="Sending…" onClick={onClick} disabled>
        Send code
      </AuroraButton>,
    );
    const button = screen.getByRole("button", { name: "Sending…" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector('[data-slot="aurora-fill"]')).toHaveClass("aurora-fill");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
