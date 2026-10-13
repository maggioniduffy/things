"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
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
    saveRequests(capture, capRequests(requests));
    close();
  }

  function saveFiles(requests: CaptureRequest[]) {
    if (requests.length === 0) return;
    saveRequests(capture, capRequests(requests));
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
        aria-label="Link or note"
        placeholder="Paste a link or write a note"
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

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Choose files
        </Button>
        <Button type="submit" disabled={empty}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * "Add" dialog: one field for a link or a note, and a file picker. Open state lives in the UI
 * store, so the toolbar button (and later the command palette) can open it.
 */
export function QuickAdd({ view }: { view: ViewSpec }) {
  const capture = useCapture(view);
  const open = useUiStore((state) => state.quickAddOpen);
  const setOpen = useUiStore((state) => state.setQuickAddOpen);
  // Radix only restores focus to a <Dialog.Trigger>; ours is opened from the store, so remember
  // whatever had focus (the toolbar button, usually) just before the dialog took it.
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={() => {
          openerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
          openerRef.current = null;
        }}
      >
        <DialogHeader>
          <DialogTitle>Add</DialogTitle>
          <DialogDescription className="text-meta">
            <Kbd>Enter</Kbd> to save, <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line.
          </DialogDescription>
        </DialogHeader>
        <QuickAddForm capture={capture} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
