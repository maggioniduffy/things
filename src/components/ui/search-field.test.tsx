import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "./search-field";

describe("SearchField", () => {
  it("is a search input with a default '/' hint", () => {
    render(<SearchField aria-label="Search" />);
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("hides the hint when null", () => {
    render(<SearchField aria-label="Search" hint={null} />);
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });

  it("clears an uncontrolled value", async () => {
    const user = userEvent.setup();
    render(<SearchField aria-label="Search" />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "cats");
    expect(input).toHaveValue("cats");
    expect(screen.queryByText("/")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("clears a controlled value through onValueChange", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();

    function Controlled() {
      const [value, setValue] = useState("dogs");
      return (
        <SearchField
          aria-label="Search"
          value={value}
          onValueChange={(next) => {
            seen(next);
            setValue(next);
          }}
        />
      );
    }

    render(<Controlled />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("dogs");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(seen).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("");
  });

  it("does not change a controlled value on its own", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField aria-label="Search" value="fixed" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("searchbox")).toHaveValue("fixed");
  });
});
