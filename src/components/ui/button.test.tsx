import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("defaults to the primary, md variant", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
    expect(button).toHaveClass("bg-primary", "h-9");
  });

  it.each([
    ["primary", "bg-primary"],
    ["secondary", "border-line"],
    ["ghost", "hover:bg-accent"],
    ["destructive", "text-destructive"],
  ] as const)("renders the %s variant", (variant, className) => {
    render(<Button variant={variant}>Action</Button>);
    const button = screen.getByRole("button", { name: "Action" });
    expect(button).toHaveAttribute("data-variant", variant);
    expect(button).toHaveClass(className);
  });

  it.each([
    ["sm", "h-8"],
    ["md", "h-9"],
    ["lg", "h-10"],
  ] as const)("renders the %s size", (size, className) => {
    render(<Button size={size}>Action</Button>);
    expect(screen.getByRole("button", { name: "Action" })).toHaveClass(className);
  });

  it("keeps the font size next to the text color", () => {
    render(<Button variant="primary">Action</Button>);
    expect(screen.getByRole("button", { name: "Action" })).toHaveClass(
      "text-body",
      "text-primary-foreground",
    );
  });

  it("forwards asChild to the child element", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/inbox">Inbox</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Inbox" });
    expect(link).toHaveAttribute("href", "/inbox");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveClass("rounded-control");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
