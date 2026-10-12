/**
 * Class strings shared by DropdownMenu and ContextMenu (both are Radix menus, same data attributes).
 * Keyboard focus is shown by the highlighted row; the native outline is intentionally transparent.
 */
export const menuSurface = [
  "z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-control border border-line bg-popover p-1 text-popover-foreground shadow-card backdrop-blur-md",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
].join(" ");

const row =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-body outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export const menuItem = [
  row,
  "text-ink data-[highlighted]:bg-accent data-[inset]:pl-8",
  "[&_svg:not([class*='text-'])]:text-ink-muted",
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:*:[svg]:text-destructive!",
].join(" ");

export const menuCheckableItem = [
  row,
  "py-1.5 pr-2 pl-8 text-ink data-[highlighted]:bg-accent",
].join(" ");

export const menuSubTrigger = [
  row,
  "text-ink data-[highlighted]:bg-accent data-[inset]:pl-8 data-[state=open]:bg-accent",
  "[&_svg:not([class*='text-'])]:text-ink-muted",
].join(" ");

export const menuLabel = "px-2 py-1.5 text-meta font-medium text-ink-subtle data-[inset]:pl-8";

export const menuSeparator = "-mx-1 my-1 h-px bg-line";

export const menuShortcut =
  "ml-auto font-sans text-meta tracking-wide text-ink-subtle tabular-nums";
