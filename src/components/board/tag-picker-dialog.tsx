"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, TagIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useT } from "@/i18n/client";
import { useBatchMove } from "@/lib/items/batch-mutations";
import { tagsQueryOptions } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { ensureTags, findTagByName, isValidTagName, normalizeTagName } from "@/lib/tags/mutations";
import { useUiStore } from "@/stores/ui-store";

type TagPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The items that get the tag. */
  ids: readonly string[];
};

/** Pick a tag for the target items: type to filter, or create a new one from what was typed. */
export function TagPickerDialog({ open, onOpenChange, ids }: TagPickerDialogProps) {
  const t = useT();
  const copy = t.items.shortcuts;
  const queryClient = useQueryClient();
  const { data } = useQuery(tagsQueryOptions(createClient()));
  const tags = data ?? [];
  const move = useBatchMove();
  const clearSelection = useUiStore((state) => state.clearSelection);
  const [query, setQuery] = useState("");

  const typed = normalizeTagName(query);
  const canCreate = isValidTagName(typed) && !findTagByName(tags, typed);

  function close(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  function attach(tagId: string, name: string) {
    close(false);
    void move(ids, { type: "tag", id: tagId }, name).then((saved) => {
      if (saved) clearSelection();
    });
  }

  async function create() {
    try {
      const [tag] = await ensureTags(createClient(), queryClient, [typed]);
      if (!tag) return;
      attach(tag.id, tag.name);
    } catch {
      toast.error(t.shell.toasts.tagsAddFailed);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={close}>
      <ResponsiveDialogContent flush showCloseButton={false} className="overflow-hidden">
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>{copy.tagTitle(ids.length)}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{copy.tagDescription}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Command className="bg-transparent backdrop-blur-none">
          <CommandInput placeholder={copy.findTag} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{copy.noTag}</CommandEmpty>
            {tags.map((tag) => (
              <CommandItem key={tag.id} value={tag.name} onSelect={() => attach(tag.id, tag.name)}>
                <TagIcon aria-hidden="true" />
                {tag.name}
              </CommandItem>
            ))}
            {canCreate ? (
              <CommandItem value={`create ${typed}`} forceMount onSelect={() => void create()}>
                <PlusIcon aria-hidden="true" />
                {copy.createTag(typed)}
              </CommandItem>
            ) : null}
          </CommandList>
        </Command>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
