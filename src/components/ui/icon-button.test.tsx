import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlusIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("uses label as its accessible name", () => {
    render(
      <IconButton label="Add item">
        <PlusIcon />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Add item" })).toHaveAttribute(
      "aria-label",
      "Add item",
    );
  });

  it("requires a label", () => {
    // @ts-expect-error label is required
    const element = <IconButton>x</IconButton>;
    expect(element).toBeTruthy();
  });

  it("is 40px by default and 32px when small", () => {
    render(
      <>
        <IconButton label="Default" tooltip={false} />
        <IconButton label="Small" size="sm" tooltip={false} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Default" })).toHaveClass("size-10");
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("size-8");
  });

  it("shows its label as a tooltip on focus", async () => {
    const user = userEvent.setup();
    render(<IconButton label="Add item" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Add item");
  });

  it("can opt out of the tooltip", async () => {
    const user = userEvent.setup();
    render(<IconButton label="Add item" tooltip={false} />);
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
