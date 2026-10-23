"use client";

import { BanIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/client";
import {
  AURORA_COLORS,
  MAX_COLLECTION_NAME_LENGTH,
  auroraColorLabel,
  auroraColorVar,
  isAuroraColor,
  normalizeCollectionName,
  parseEmoji,
} from "@/lib/collections/fields";
import { useCollectionActions } from "@/lib/collections/mutations";
import type { SidebarCollection } from "@/lib/sidebar/queries";
import { cn } from "@/lib/utils";

type CollectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The collection to edit; omit to create a new one. */
  collection?: SidebarCollection;
};

/** The form; mounted only while open, so it starts from the collection (or empty) every time. */
function CollectionForm({
  collection,
  close,
}: {
  collection?: SidebarCollection;
  close: () => void;
}) {
  const t = useT().shell;
  const { create, update } = useCollectionActions();
  const nameId = useId();
  const emojiId = useId();
  const emojiErrorId = useId();
  const colorName = useId();

  const [name, setName] = useState(collection?.name ?? "");
  const [emoji, setEmoji] = useState(collection?.emoji ?? "");
  const [color, setColor] = useState<string | null>(
    isAuroraColor(collection?.color) ? collection.color : null,
  );
  const [emojiInvalid, setEmojiInvalid] = useState(false);

  const trimmedName = normalizeCollectionName(name);
  const editing = collection !== undefined;

  function submit() {
    if (trimmedName === "") return;
    const parsedEmoji = parseEmoji(emoji);
    if (parsedEmoji === undefined) {
      setEmojiInvalid(true);
      return;
    }
    // Optimistic: the sidebar updates at once, so the dialog does not wait for the save.
    if (collection) {
      void update(collection.id, { name: trimmedName, emoji: parsedEmoji, color });
    } else {
      void create({ name: trimmedName, emoji: parsedEmoji, color });
    }
    close();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={nameId} className="text-meta text-ink-muted font-medium">
          {t.actions.name}
        </label>
        <Input
          id={nameId}
          value={name}
          required
          maxLength={MAX_COLLECTION_NAME_LENGTH}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={emojiId} className="text-meta text-ink-muted font-medium">
          {t.collectionDialog.emoji}
        </label>
        <Input
          id={emojiId}
          value={emoji}
          maxLength={16}
          autoComplete="off"
          aria-invalid={emojiInvalid || undefined}
          aria-describedby={emojiInvalid ? emojiErrorId : undefined}
          onChange={(event) => {
            setEmoji(event.target.value);
            setEmojiInvalid(false);
          }}
          className="w-24"
        />
        {emojiInvalid ? (
          <p id={emojiErrorId} role="alert" className="text-meta text-destructive">
            {t.collectionDialog.emojiInvalid}
          </p>
        ) : null}
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="text-meta text-ink-muted mb-1.5 font-medium">
          {t.collectionDialog.color}
        </legend>
        <div className="flex flex-wrap gap-2">
          <ColorSwatch
            group={colorName}
            value={null}
            label={t.colors.none}
            checked={color === null}
            onSelect={() => setColor(null)}
          />
          {AURORA_COLORS.map((token) => (
            <ColorSwatch
              key={token}
              group={colorName}
              value={token}
              label={auroraColorLabel(token, t.colors)}
              checked={color === token}
              onSelect={() => setColor(token)}
            />
          ))}
        </div>
      </fieldset>

      <ResponsiveDialogFooter>
        <Button type="button" variant="secondary" onClick={close}>
          {t.actions.cancel}
        </Button>
        <Button type="submit" disabled={trimmedName === ""}>
          {editing ? t.actions.save : t.actions.create}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

function ColorSwatch({
  group,
  value,
  label,
  checked,
  onSelect,
}: {
  group: string;
  value: string | null;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="relative inline-flex">
      <input
        type="radio"
        name={group}
        value={value ?? ""}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        style={{ backgroundColor: auroraColorVar(value) }}
        className={cn(
          "border-line text-ink-muted grid size-7 cursor-pointer place-items-center rounded-full border",
          "ease-out-soft transition-[box-shadow] duration-(--duration-fast)",
          "peer-checked:ring-ink peer-checked:ring-offset-surface peer-checked:ring-2 peer-checked:ring-offset-2",
          "peer-focus-visible:outline-ring peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
        )}
      >
        {value === null ? <BanIcon className="size-3.5" /> : null}
      </span>
      <span className="sr-only">{label}</span>
    </label>
  );
}

/** Create (no `collection`) or edit a collection: name, optional emoji, optional aurora color. */
export function CollectionDialog({ open, onOpenChange, collection }: CollectionDialogProps) {
  const t = useT().shell;
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {collection ? t.collectionDialog.editTitle : t.collectionDialog.newTitle}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-meta">
            {t.collectionDialog.description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <CollectionForm collection={collection} close={() => onOpenChange(false)} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
