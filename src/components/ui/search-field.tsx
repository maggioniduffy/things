"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";
import { Input } from "./input";
import { Kbd } from "./kbd";

type SearchFieldProps = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  /** Fires on typing and on clear, with the new value. */
  onValueChange?: (value: string) => void;
  /** Shortcut hint shown on the right while empty. Default "/"; `null` hides it. */
  hint?: string | null;
  clearLabel?: string;
};

function SearchField({
  className,
  value,
  defaultValue = "",
  onValueChange,
  onChange,
  hint = "/",
  clearLabel = "Clear search",
  ref,
  ...props
}: SearchFieldProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [innerValue, setInnerValue] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : innerValue;

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  function update(next: string) {
    if (!isControlled) setInnerValue(next);
    onValueChange?.(next);
  }

  return (
    <div data-slot="search-field" className={cn("relative w-full", className)}>
      <SearchIcon
        aria-hidden="true"
        className="text-ink-subtle pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
      />
      <Input
        {...props}
        ref={setRefs}
        type="search"
        value={current}
        onChange={(event) => {
          onChange?.(event);
          update(event.target.value);
        }}
        className="pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {current === "" ? (
        hint ? (
          <Kbd className="pointer-events-none absolute inset-y-0 right-2 my-auto">{hint}</Kbd>
        ) : null
      ) : (
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          label={clearLabel}
          tooltip={false}
          className="absolute inset-y-0 right-0.5 my-auto"
          onClick={() => {
            update("");
            inputRef.current?.focus();
          }}
        >
          <XIcon />
        </IconButton>
      )}
    </div>
  );
}

export { SearchField };
export type { SearchFieldProps };
