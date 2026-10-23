"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/client";
import { useTagManager, normalizeTagName } from "@/lib/tags/mutations";
import { MAX_TAG_LENGTH } from "@/lib/tags/parse";
import type { SidebarTag } from "@/lib/sidebar/queries";

function RenameForm({ tag, close }: { tag: SidebarTag; close: () => void }) {
  const t = useT().shell;
  const { rename } = useTagManager();
  const id = useId();
  const [name, setName] = useState(tag.name);
  const empty = normalizeTagName(name) === "";

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (empty) return;
        // Optimistic: the sidebar updates at once, so the dialog does not wait for the save.
        void rename(tag.id, name);
        close();
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={id} className="text-meta text-ink-muted font-medium">
          {t.actions.name}
        </label>
        <Input
          id={id}
          value={name}
          required
          maxLength={MAX_TAG_LENGTH}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={close}>
          {t.actions.cancel}
        </Button>
        <Button type="submit" disabled={empty}>
          {t.actions.save}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Rename a tag. The form is mounted only while open, so it always starts from the current name. */
export function TagRenameDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: SidebarTag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT().shell;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.tagDialog.renameTitle}</DialogTitle>
        </DialogHeader>
        <RenameForm tag={tag} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
