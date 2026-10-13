"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { itemTagsQueryKey, itemTagsQueryOptions } from "@/lib/items/item-query";
import type { BoardItem } from "@/lib/items/queries";
import { useTagActions, type ItemActions } from "@/lib/items/state-mutations";
import { createClient } from "@/lib/supabase/client";
import { collectionsQueryOptions, tagsQueryOptions } from "@/lib/sidebar/queries";
import { useTagManager } from "@/lib/tags/mutations";
import { MAX_TAG_LENGTH, parseHashtags } from "@/lib/tags/parse";
import { cn } from "@/lib/utils";

/**
 * A text draft that saves on demand (blur, Enter) and once more when the field unmounts, so
 * closing the drawer with Esc never drops an edit. An outside change (rollback, refetch) resets it.
 */
export function useDraft(value: string, commit: (draft: string) => void) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  const latest = useRef({ draft, value, commit });
  useEffect(() => {
    latest.current = { draft, value, commit };
  });
  useEffect(
    () => () => {
      const { draft: pending, value: saved, commit: save } = latest.current;
      if (pending !== saved) save(pending);
    },
    [],
  );

  return {
    draft,
    setDraft,
    flush: () => {
      if (draft !== value) commit(draft);
    },
  };
}

export function TitleField({ item, actions }: { item: BoardItem; actions: ItemActions }) {
  const { addTagsByName } = useTagActions();
  const { draft, setDraft, flush } = useDraft(item.title ?? "", (next) => {
    const typed = next.trim();
    // `#tags` in the title become tags and leave the title; a title that is only tags stays as typed.
    const { names, text } = parseHashtags(typed);
    const title = names.length > 0 && text !== "" ? text : typed;
    if (title !== (item.title ?? "")) {
      void actions.edit(item, { title: title === "" ? null : title });
    }
    if (names.length > 0) void addTagsByName(item.id, names);
  });
  return (
    <Input
      aria-label="Title"
      value={draft}
      placeholder="Untitled"
      maxLength={300}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={flush}
      onKeyDown={(event) => {
        // Enter while an IME is composing confirms the composition, not the field.
        if (event.key === "Enter" && !event.nativeEvent.isComposing) event.currentTarget.blur();
      }}
      className="text-card h-10 font-medium"
    />
  );
}

export function NoteField({ item, actions }: { item: BoardItem; actions: ItemActions }) {
  const { addTagsByName } = useTagActions();
  const { draft, setDraft, flush } = useDraft(item.note ?? "", (next) => {
    if (next === (item.note ?? "")) return;
    void actions.edit(item, { note: next });
    // The note keeps its text; only `#tags` that were not in it before are attached, so a tag
    // removed by hand does not come back with the next edit.
    const had = new Set(parseHashtags(item.note ?? "").names.map((name) => name.toLowerCase()));
    const added = parseHashtags(next).names.filter((name) => !had.has(name.toLowerCase()));
    if (added.length > 0) void addTagsByName(item.id, added);
  });
  return (
    <textarea
      aria-label="Note"
      value={draft}
      placeholder="Write something"
      rows={10}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={flush}
      className={cn(
        "rounded-control border-line bg-aurora-coral/20 text-body text-ink min-h-48 w-full resize-y border px-3 py-2",
        "placeholder:text-ink-subtle ease-out-soft hover:border-ink/30 transition-[color,background-color,border-color] duration-(--duration-fast)",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
      )}
    />
  );
}

const SELECT_CLASS = cn(
  "rounded-control border-line bg-surface text-body text-ink h-9 w-full min-w-0 border px-2",
  "ease-out-soft hover:border-ink/30 transition-[color,background-color,border-color] duration-(--duration-fast)",
  "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
);

export function CollectionField({ item, actions }: { item: BoardItem; actions: ItemActions }) {
  const id = useId();
  const collections = useQuery(collectionsQueryOptions(createClient()));
  const options = collections.data ?? [];
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-meta text-ink-muted font-medium">
        Collection
      </label>
      <select
        id={id}
        value={item.collection_id ?? ""}
        onChange={(event) => void actions.edit(item, { collection_id: event.target.value || null })}
        className={SELECT_CLASS}
      >
        <option value="">Inbox</option>
        {options.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.emoji ? `${collection.emoji} ` : ""}
            {collection.name}
          </option>
        ))}
        {/* A collection the list does not know (still loading): keep the current value selectable. */}
        {item.collection_id && !options.some((c) => c.id === item.collection_id) ? (
          <option value={item.collection_id}>Collection</option>
        ) : null}
      </select>
    </div>
  );
}

export function TagsField({ item }: { item: BoardItem }) {
  const id = useId();
  const client = createClient();
  const queryClient = useQueryClient();
  const allTags = useQuery(tagsQueryOptions(client));
  const attached = useQuery(itemTagsQueryOptions(client, item.id));
  const { addTag, removeTag } = useTagActions();
  const { create } = useTagManager();
  const [newName, setNewName] = useState("");

  async function submitNew() {
    const name = newName;
    if (name.trim() === "") return;
    setNewName("");
    // An existing tag (any casing) is reused; a new one appears at once and is saved behind it.
    const tag = await create(name);
    if (
      tag &&
      !(queryClient.getQueryData<string[]>(itemTagsQueryKey(item.id)) ?? []).includes(tag.id)
    ) {
      await addTag(item.id, tag.id);
    }
  }

  const tags = allTags.data ?? [];
  const attachedIds = new Set(attached.data ?? []);
  const applied = tags.filter((tag) => attachedIds.has(tag.id));
  const available = tags.filter((tag) => !attachedIds.has(tag.id));

  return (
    <div className="grid gap-1.5">
      <span id={id} className="text-meta text-ink-muted font-medium">
        Tags
      </span>
      {applied.length > 0 ? (
        <ul aria-labelledby={id} className="flex flex-wrap gap-1.5">
          {applied.map((tag) => (
            <li key={tag.id}>
              <Badge className="pr-1">
                {tag.name}
                <IconButton
                  variant="ghost"
                  size="sm"
                  label={`Remove tag ${tag.name}`}
                  tooltip={false}
                  className="size-5"
                  onClick={() => void removeTag(item.id, tag.id)}
                >
                  <XIcon className="size-3" />
                </IconButton>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {available.length > 0 ? (
        <select
          aria-label="Add a tag"
          value=""
          onChange={(event) => {
            if (event.target.value) void addTag(item.id, event.target.value);
          }}
          className={SELECT_CLASS}
        >
          <option value="">Add a tag…</option>
          {available.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      ) : null}
      <Input
        aria-label="New tag"
        value={newName}
        placeholder="New tag, then Enter"
        maxLength={MAX_TAG_LENGTH}
        onChange={(event) => setNewName(event.target.value)}
        onKeyDown={(event) => {
          // Enter while an IME is composing confirms the composition, not the field.
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void submitNew();
        }}
      />
    </div>
  );
}
