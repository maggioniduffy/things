"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "./drawer";

/**
 * A form dialog that is a centered `Dialog` from `sm` up and a bottom sheet (vaul `Drawer`) below,
 * so fields stay above the on-screen keyboard. The query is `max-width`, so where `matchMedia` is
 * missing (tests, very old browsers) it reads false and the plain dialog renders.
 */
const MOBILE_QUERY = "(max-width: 639px)";

const SheetContext = React.createContext(false);

type RootProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

function ResponsiveDialog({ open, onOpenChange, children }: RootProps) {
  const sheet = useMediaQuery(MOBILE_QUERY);
  return (
    <SheetContext.Provider value={sheet}>
      {sheet ? (
        <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </SheetContext.Provider>
  );
}

type ContentProps = {
  className?: string;
  children?: React.ReactNode;
  /** Dialog only: the sheet is closed by swiping, tapping outside or its own buttons. */
  showCloseButton?: boolean;
  /** Content with its own padding (a command list): no inset in either layout. */
  flush?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton,
  flush = false,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: ContentProps) {
  const sheet = React.useContext(SheetContext);
  if (sheet) {
    return (
      <DrawerContent
        className={cn("data-[vaul-drawer-direction=bottom]:max-h-[85svh]", className)}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {/* The only scroll area, so the handle stays put and tall forms scroll inside the sheet. */}
        <div
          data-slot="responsive-dialog-body"
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]",
            flush ? "px-0" : "px-4",
          )}
        >
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent
      showCloseButton={showCloseButton}
      className={cn(flush && "overflow-hidden p-0", className)}
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const sheet = React.useContext(SheetContext);
  return sheet ? (
    <DrawerHeader className={cn("gap-1 p-0 text-left", className)} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  );
}

function ResponsiveDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  const sheet = React.useContext(SheetContext);
  return sheet ? (
    <DrawerTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  );
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const sheet = React.useContext(SheetContext);
  return sheet ? (
    <DrawerDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}

/** Buttons side by side in the sheet; the dialog keeps its own footer layout. */
function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  const sheet = React.useContext(SheetContext);
  return sheet ? (
    <div
      data-slot="responsive-dialog-footer"
      className={cn("flex flex-row gap-2 *:flex-1", className)}
      {...props}
    />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
