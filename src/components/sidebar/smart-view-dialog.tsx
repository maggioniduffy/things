"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
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
import { normalizeCollectionName, parseEmoji } from "@/lib/collections/fields";
import { cleanRules, MAX_SAVED_WITHIN_DAYS, parseDomainList, type Rules } from "@/lib/filters";
import { kindPluralLabel } from "@/lib/kinds";
import {
  collectionsQueryOptions,
  tagsQueryOptions,
  type SidebarSmartView,
} from "@/lib/sidebar/queries";
import { MAX_SMART_VIEW_NAME_LENGTH, useSmartViewActions } from "@/lib/smart-views/mutations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ITEM_KINDS } from "@/lib/views";
import type { ItemKind } from "@/types/supabase";

type SmartViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The smart view to edit; omit to create a new one. */
  smartView?: SidebarSmartView;
};

type Tri = "any" | "yes" | "no";

function triOf(value: boolean | undefined): Tri {
  return value === undefined ? "any" : value ? "yes" : "no";
}

function boolOf(value: Tri): boolean | undefined {
  return value === "any" ? undefined : value === "yes";
}

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/** A set of toggle chips (checkboxes) in a labelled group. */
function ChipGroup<T extends string>({
  legend,
  hint,
  options,
  selected,
  onToggle,
  empty,
}: {
  legend: string;
  hint?: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Shown instead of chips when there is nothing to choose from. */
  empty?: string;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-meta text-ink-muted mb-1.5 font-medium">
        {legend}
        {hint ? <span className="text-ink-subtle font-normal"> ({hint})</span> : null}
      </legend>
      {options.length === 0 && empty ? (
        <p className="text-meta text-ink-subtle">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <label key={option.value} className="relative inline-flex">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "rounded-control border-line text-meta text-ink-muted inline-flex h-7 cursor-pointer items-center border px-2.5",
                  "ease-out-soft hover:border-ink/30 transition-[color,background-color,border-color] duration-(--duration-fast)",
                  "peer-checked:bg-ink peer-checked:text-primary-foreground peer-checked:border-transparent",
                  "peer-focus-visible:outline-ring peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                )}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Pick one of a few labelled values (radio buttons drawn as a segmented control). */
function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const group = useId();
  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-meta text-ink-muted mb-1.5 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label key={option.value} className="relative inline-flex">
            <input
              type="radio"
              name={group}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "rounded-control border-line text-meta text-ink-muted inline-flex h-7 cursor-pointer items-center border px-2.5",
                "ease-out-soft hover:border-ink/30 transition-[color,background-color,border-color] duration-(--duration-fast)",
                "peer-checked:bg-ink peer-checked:text-primary-foreground peer-checked:border-transparent",
                "peer-focus-visible:outline-ring peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-meta text-ink-muted font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** The form; mounted only while open, so it starts from the view (or empty) every time. */
function SmartViewForm({ smartView, close }: { smartView?: SidebarSmartView; close: () => void }) {
  const t = useT().shell;
  const d = t.smartViewDialog;
  const client = createClient();
  const { data: collections } = useQuery(collectionsQueryOptions(client));
  const { data: tags } = useQuery(tagsQueryOptions(client));
  const { create, update } = useSmartViewActions();

  const nameId = useId();
  const emojiId = useId();
  const emojiErrorId = useId();
  const domainsId = useId();
  const daysId = useId();
  const queryId = useId();

  const initial: Rules = smartView?.rules ?? {};
  const [name, setName] = useState(smartView?.name ?? "");
  const [emoji, setEmoji] = useState(smartView?.icon ?? "");
  const [emojiInvalid, setEmojiInvalid] = useState(false);
  const [kinds, setKinds] = useState<ItemKind[]>(initial.kinds ?? []);
  const [collectionIds, setCollectionIds] = useState<string[]>(initial.collectionIds ?? []);
  const [tagIds, setTagIds] = useState<string[]>(initial.tagIds ?? []);
  const [domains, setDomains] = useState((initial.domains ?? []).join(", "));
  const [read, setRead] = useState<Tri>(triOf(initial.isRead));
  const [favorite, setFavorite] = useState<Tri>(triOf(initial.isFavorite));
  const [days, setDays] = useState(initial.savedWithinDays ? String(initial.savedWithinDays) : "");
  const [query, setQuery] = useState(initial.query ?? "");

  const trimmedName = normalizeCollectionName(name);
  const editing = smartView !== undefined;
  const daysNumber = days.trim() === "" ? undefined : Number(days);
  const daysInvalid =
    daysNumber !== undefined &&
    (!Number.isInteger(daysNumber) || daysNumber < 1 || daysNumber > MAX_SAVED_WITHIN_DAYS);

  function submit() {
    if (trimmedName === "" || daysInvalid) return;
    const parsedEmoji = parseEmoji(emoji);
    if (parsedEmoji === undefined) {
      setEmojiInvalid(true);
      return;
    }
    // Ids of collections or tags that no longer exist are dropped once the lists are loaded.
    const knownCollections = collections ? new Set(collections.map((entry) => entry.id)) : null;
    const knownTags = tags ? new Set(tags.map((entry) => entry.id)) : null;
    const rules = cleanRules({
      kinds,
      collectionIds: knownCollections
        ? collectionIds.filter((id) => knownCollections.has(id))
        : collectionIds,
      tagIds: knownTags ? tagIds.filter((id) => knownTags.has(id)) : tagIds,
      domains: parseDomainList(domains),
      isRead: boolOf(read),
      isFavorite: boolOf(favorite),
      savedWithinDays: daysNumber,
      query,
    });
    // Optimistic: the sidebar updates at once, so the dialog does not wait for the save.
    if (smartView) {
      void update(smartView.id, { name: trimmedName, icon: parsedEmoji, rules });
    } else {
      void create({ name: trimmedName, icon: parsedEmoji, rules });
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
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={t.actions.name} htmlFor={nameId}>
          <Input
            id={nameId}
            value={name}
            required
            maxLength={MAX_SMART_VIEW_NAME_LENGTH}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="grid content-start gap-1.5">
          <label htmlFor={emojiId} className="text-meta text-ink-muted font-medium">
            {d.emoji}
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
              {d.emojiInvalid}
            </p>
          ) : null}
        </div>
      </div>

      <ChipGroup
        legend={d.kinds}
        hint={d.anyOf}
        options={ITEM_KINDS.map((kind) => ({ value: kind, label: kindPluralLabel(t.kinds, kind) }))}
        selected={kinds}
        onToggle={(kind) => setKinds((current) => toggled(current, kind))}
      />

      <ChipGroup
        legend={d.collections}
        hint={d.anyOf}
        options={(collections ?? []).map((collection) => ({
          value: collection.id,
          label: collection.emoji ? `${collection.emoji} ${collection.name}` : collection.name,
        }))}
        selected={collectionIds}
        onToggle={(id) => setCollectionIds((current) => toggled(current, id))}
        empty={d.noCollections}
      />

      <ChipGroup
        legend={d.tags}
        hint={d.mustHaveAll}
        options={(tags ?? []).map((tag) => ({ value: tag.id, label: `#${tag.name}` }))}
        selected={tagIds}
        onToggle={(id) => setTagIds((current) => toggled(current, id))}
        empty={d.noTags}
      />

      <Field label={d.domains} htmlFor={domainsId}>
        <Input
          id={domainsId}
          value={domains}
          placeholder={d.domainsPlaceholder}
          autoComplete="off"
          onChange={(event) => setDomains(event.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          legend={d.readStatus}
          options={[
            { value: "any", label: d.any },
            { value: "no", label: d.unread },
            { value: "yes", label: d.read },
          ]}
          value={read}
          onChange={setRead}
        />
        <Segmented
          legend={d.favorite}
          options={[
            { value: "any", label: d.any },
            { value: "yes", label: d.favorites },
            { value: "no", label: d.notFavorites },
          ]}
          value={favorite}
          onChange={setFavorite}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.savedWithin} htmlFor={daysId}>
          <Input
            id={daysId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SAVED_WITHIN_DAYS}
            step={1}
            value={days}
            placeholder={d.anyTime}
            aria-invalid={daysInvalid || undefined}
            onChange={(event) => setDays(event.target.value)}
          />
        </Field>
        <Field label={d.containsText} htmlFor={queryId}>
          <Input
            id={queryId}
            value={query}
            autoComplete="off"
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>

      <ResponsiveDialogFooter>
        <Button type="button" variant="secondary" onClick={close}>
          {t.actions.cancel}
        </Button>
        <Button type="submit" disabled={trimmedName === "" || daysInvalid}>
          {editing ? t.actions.save : t.actions.create}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

/** Create (no `smartView`) or edit a smart view: name, emoji and the filter rules. */
export function SmartViewDialog({ open, onOpenChange, smartView }: SmartViewDialogProps) {
  const d = useT().shell.smartViewDialog;
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{smartView ? d.editTitle : d.newTitle}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-meta">{d.description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <SmartViewForm smartView={smartView} close={() => onOpenChange(false)} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
