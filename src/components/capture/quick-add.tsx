"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Kbd } from "@/components/ui/kbd";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useT } from "@/i18n/client";
import { useCapture } from "@/lib/items/mutations";
import { noteTagging } from "@/lib/tags/parse";
import type { ViewSpec } from "@/lib/views";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  capRequests,
  fileRequests,
  requestsFromText,
  saveRequests,
  type Capture,
  type CaptureRequest,
} from "./clipboard";

const TEXTAREA_MAX_HEIGHT_PX = 240;

/** Grows the textarea with its content, up to a cap, then scrolls. */
function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [value]);
  return ref;
}

/** The dialog body; mounted only while open, so the draft starts empty every time. */
function QuickAddForm({ capture, close }: { capture: Capture; close: () => void }) {
  const defaultTags = useUiStore((state) => state.quickAddDefaults?.tagNames);
  const t = useT().items.capture;
  const [text, setText] = useState("");
  const textareaRef = useAutoGrow(text);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const empty = text.trim() === "";

  function saveText() {
    if (empty) return;
    // Typed `#tags` are attached to notes; links keep their text as it is.
    const requests = requestsFromText(text).map((request) =>
      request.type === "note" ? { ...request, ...noteTagging(request.text) } : request,
    );
    saveRequests(capture, capRequests(requests), { tagNames: defaultTags });
    close();
  }

  function saveFiles(requests: CaptureRequest[]) {
    if (requests.length === 0) return;
    saveRequests(capture, capRequests(requests), { tagNames: defaultTags });
    close();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        saveText();
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        rows={3}
        aria-label={t.fieldLabel}
        placeholder={t.fieldPlaceholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter while an IME is composing confirms the composition, not the form.
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          saveText();
        }}
        onPaste={(event) => {
          const files = fileRequests(event.clipboardData);
          if (files.length === 0) return;
          event.preventDefault();
          saveFiles(files);
        }}
        className={cn(
          "rounded-control border-line bg-surface text-body text-ink min-h-20 w-full resize-none border px-3 py-2",
          "placeholder:text-ink-subtle ease-out-soft hover:border-ink/30 transition-[color,background-color,border-color] duration-(--duration-fast)",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-testid="quick-add-files"
        onChange={(event) => {
          const files = fileRequests({ files: event.target.files });
          // Lets the same file be chosen again next time.
          event.target.value = "";
          saveFiles(files);
        }}
      />

      {/* A plain row, so it reads the same in the dialog and the mobile sheet. */}
      <div className="flex flex-row justify-between gap-2">
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          {t.chooseFiles}
        </Button>
        <Button type="submit" disabled={empty}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}

/**
 * "Add" dialog: one field for a link or a note, and a file picker. Open state lives in the UI
 * store, so the toolbar button (and later the command palette) can open it. Below `sm` it is a
 * compact bottom sheet that stays above the on-screen keyboard.
 */
export function QuickAdd({ view }: { view: ViewSpec }) {
  const t = useT().items.capture;
  const capture = useCapture(view);
  const open = useUiStore((state) => state.quickAddOpen);
  const setOpen = useUiStore((state) => state.setQuickAddOpen);
  const isDesktop = useMediaQuery("(min-width: 640px)");
  // Radix only restores focus to a <Dialog.Trigger>; ours is opened from the store, so remember
  // whatever had focus (the toolbar button, usually) just before the dialog took it.
  const openerRef = useRef<HTMLElement | null>(null);
  const rememberOpener = () => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const restoreOpener = (event: Event) => {
    event.preventDefault();
    openerRef.current?.focus();
    openerRef.current = null;
  };

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={setOpen} direction="bottom" repositionInputs>
        <DrawerContent
          onOpenAutoFocus={(event) => {
            rememberOpener();
            // vaul's content is not always focusable on open; focus the field explicitly.
            event.preventDefault();
            if (event.target instanceof HTMLElement)
              event.target.querySelector("textarea")?.focus();
          }}
          onCloseAutoFocus={restoreOpener}
        >
          <DrawerHeader>
            <DrawerTitle>{t.add}</DrawerTitle>
            <DrawerDescription className="sr-only">{t.shortcutHint}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <QuickAddForm capture={capture} close={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onOpenAutoFocus={rememberOpener} onCloseAutoFocus={restoreOpener}>
        <DialogHeader>
          <DialogTitle>{t.add}</DialogTitle>
          <DialogDescription className="text-meta">
            <Kbd>Enter</Kbd> {t.enterToSave} <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> {t.forNewLine}
          </DialogDescription>
        </DialogHeader>
        <QuickAddForm capture={capture} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
