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
import { createClient } from "@/lib/supabase/client";
import { collectionsQueryOptions, type SidebarCollection } from "@/lib/sidebar/queries";

/** The user's collections, for "Move to…" menus. Empty until loaded. */
export function useCollectionList(): SidebarCollection[] {
  const { data } = useQuery(collectionsQueryOptions(createClient()));
  return data ?? [];
}

export function movePrompt(count: number): string {
  return `Move ${count} ${count === 1 ? "item" : "items"} to…`;
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
  const collections = useCollectionList();
  const pick = (id: string | null, label: string) => {
    onOpenChange(false);
    onPick(id, label);
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={movePrompt(count)}
      description="Choose where to move the selected items."
    >
      <CommandInput placeholder="Find a collection" />
      <CommandList>
        <CommandEmpty>No collection found.</CommandEmpty>
        <CommandItem
          value="Inbox"
          disabled={currentCollectionId === null}
          onSelect={() => pick(null, "Inbox")}
        >
          <InboxIcon aria-hidden="true" />
          Inbox
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
