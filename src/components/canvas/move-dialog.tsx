"use client";

import { useQuery } from "@tanstack/react-query";
import { InboxIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { collectionsQueryOptions, type SidebarCollection } from "@/lib/sidebar/queries";

/** The user's collections, for "Move to…" menus. Empty until loaded. */
export function useCollectionList(): SidebarCollection[] {
  const { data } = useQuery(collectionsQueryOptions(createClient()));
  return data ?? [];
}

type MoveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** The collection of this canvas (null = Inbox): moving there changes nothing, so it is disabled. */
  currentCollectionId: string | null;
  onPick: (collectionId: string | null, label: string) => void;
};

/** Pick a destination for the selected cards: type to filter, Enter picks. */
export function MoveDialog({
  open,
  onOpenChange,
  count,
  currentCollectionId,
  onPick,
}: MoveDialogProps) {
  const t = useT().items;
  const collections = useCollectionList();
  const pick = (id: string | null, label: string) => {
    onOpenChange(false);
    onPick(id, label);
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.canvas.movePrompt(count)}
      description={t.canvas.moveDescription}
    >
      <CommandInput placeholder={t.canvas.findCollection} />
      <CommandList>
        <CommandEmpty>{t.canvas.noCollection}</CommandEmpty>
        <CommandItem
          value={t.inbox}
          disabled={currentCollectionId === null}
          onSelect={() => pick(null, t.inbox)}
        >
          <InboxIcon aria-hidden="true" />
          {t.inbox}
        </CommandItem>
        {collections.map((collection) => (
          <CommandItem
            key={collection.id}
            value={collection.name}
            disabled={collection.id === currentCollectionId}
            onSelect={() => pick(collection.id, collection.name)}
          >
            <span aria-hidden="true" className="w-4 text-center">
              {collection.emoji ?? ""}
            </span>
            {collection.name}
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
