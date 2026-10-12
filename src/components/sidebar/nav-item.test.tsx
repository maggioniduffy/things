import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavItem } from "./nav-item";

const nav = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

describe("NavItem", () => {
  beforeEach(() => {
    nav.pathname = "/app";
  });

  it("marks the link for the current pathname with aria-current", () => {
    render(<NavItem href="/app" icon={<svg />} label="Inbox" />);
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark other links", () => {
    render(<NavItem href="/app/all" icon={<svg />} label="All" />);
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("shows the count only when it is greater than zero", () => {
    const { rerender } = render(<NavItem href="/app" icon={<svg />} label="Inbox" count={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();

    rerender(<NavItem href="/app" icon={<svg />} label="Inbox" count={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    rerender(<NavItem href="/app" icon={<svg />} label="Inbox" />);
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();
  });

  it("calls onNavigate when clicked", async () => {
    // jsdom cannot navigate: stop the default so the click stays in-page.
    const onNavigate = vi.fn();
    document.addEventListener("click", (event) => event.preventDefault(), { once: true });
    render(<NavItem href="/app/all" icon={<svg />} label="All" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("link", { name: "All" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
