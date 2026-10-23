"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { getActiveMessages } from "@/i18n/active";

const UNDO_DURATION_MS = 5000;

/** Sonner toaster on our tokens. Mount once in the root layout. */
function Toaster({ toastOptions, style, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      richColors={false}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          // Sonner's own stylesheet is unlayered, so the utilities that must win use `!`.
          toast: "!backdrop-blur-md !font-sans !text-body !shadow-card",
          title: "!font-medium",
          description: "!text-meta !text-ink-muted",
          actionButton:
            "!h-8 !rounded-control !bg-ink !px-3 !text-body !font-medium !text-primary-foreground",
          cancelButton:
            "!h-8 !rounded-control !border !border-line !bg-transparent !px-3 !text-body !font-medium !text-ink",
          ...toastOptions?.classNames,
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-line)",
          "--border-radius": "var(--radius-card)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

/** Toast with an "Undo" action that stays for 5 seconds. Returns the toast id. */
function undoToast(message: string, onUndo: () => void) {
  return toast(message, {
    duration: UNDO_DURATION_MS,
    action: {
      label: getActiveMessages().shell.ui.undo,
      onClick: () => onUndo(),
    },
  });
}

export { Toaster, toast, undoToast };
