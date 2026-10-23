"use client";

import { useState } from "react";
import { CopyIcon, InboxIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { toast, undoToast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/board/empty-state";

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename collection</DialogTitle>
          <DialogDescription>Pick a new name. You can change it again later.</DialogDescription>
        </DialogHeader>
        <Input aria-label="Collection name" defaultValue="Reading list" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A dialog at sm and up, a bottom sheet below. Resize the window to see both. */
export function ResponsiveDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open responsive dialog
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>New collection</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              A bottom sheet on phones, a dialog on wider screens.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Input aria-label="Collection name" defaultValue="Recipes" />
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Create</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

export function EmptyStateDemo() {
  return (
    <div className="border-line rounded-card flex w-full overflow-hidden border">
      <EmptyState view={{ type: "inbox" }} />
    </div>
  );
}

export function DrawerDemo() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="secondary">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Item details</DrawerTitle>
          <DrawerDescription>Preview, note and metadata live here.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Close drawer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function DropdownDemo() {
  const [pinned, setPinned] = useState(true);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Item</DropdownMenuLabel>
        <DropdownMenuItem>
          <PencilIcon /> Rename
          <DropdownMenuShortcut>R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CopyIcon /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <StarIcon /> Favorite
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
          Pin to top
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2Icon /> Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ContextMenuDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="rounded-card border-line text-body text-ink-muted flex h-32 w-full max-w-sm items-center justify-center border border-dashed select-none">
          Right-click here
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem>
          <PencilIcon /> Rename
          <ContextMenuShortcut>R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <CopyIcon /> Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          <Trash2Icon /> Move to trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function CommandDemo() {
  return (
    <Command className="border-line max-w-md border" aria-label="Command palette demo">
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>
            <PlusIcon /> Add link
            <CommandShortcut>⌘L</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <PencilIcon /> Add note
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem>
            <InboxIcon /> Inbox
          </CommandItem>
          <CommandItem>
            <StarIcon /> Favorites
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function ToastDemo() {
  return (
    <>
      <Button variant="secondary" onClick={() => toast("Saved to Inbox")}>
        Show toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => undoToast("Moved to trash", () => toast("Restored"))}
      >
        Show undo toast
      </Button>
    </>
  );
}

export function SearchDemo() {
  const [value, setValue] = useState("");
  return (
    <div className="grid w-full max-w-sm gap-3">
      <SearchField
        aria-label="Search (empty)"
        placeholder="Search your things"
        value={value}
        onValueChange={setValue}
      />
      <SearchField aria-label="Search (filled)" defaultValue="design" hint={null} />
    </div>
  );
}
