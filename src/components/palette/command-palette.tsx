"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { saveRequests } from "@/components/capture/clipboard";
import { useOpenItem } from "@/components/drawer/item-param";
import { useViewer } from "@/components/providers/viewer-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useT } from "@/i18n/client";
import { findCachedItem } from "@/lib/items/cache";
import { useCapture } from "@/lib/items/mutations";
import type { BoardItem } from "@/lib/items/queries";
import { searchItems } from "@/lib/items/search";
import { useItemActions } from "@/lib/items/state-mutations";
import {
  collectionsQueryOptions,
  smartViewsQueryOptions,
  tagsQueryOptions,
} from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { parseView, viewHref, type SystemView, type ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { ClipboardDeniedError, readClipboardRequests } from "./clipboard-save";

const SEARCH_DEBOUNCE_MS = 200;
const RESULT_LIMIT = 8;

/** The "Go to" targets that have a key chord (G then …), shown as hints. */
const GO_VIEWS: { view: SystemView; hint?: string }[] = [
  { view: "inbox", hint: "G I" },
  { view: "all", hint: "G A" },
  { view: "unread" },
  { view: "favorites", hint: "G F" },
  { view: "archive" },
  { view: "trash" },
];

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** The view the user is looking at, so a saved clipboard lands where a paste would. */
function viewFromPath(pathname: string): ViewSpec {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  return parseView(segments) ?? { type: "inbox" };
}

type Context = {
  isGuest: boolean;
  /** The card under the keyboard cursor, when there is one. */
  cursorItem: BoardItem | null;
  close: () => void;
  openItem: (item: BoardItem) => void;
  goTo: (href: string) => void;
  saveClipboard: () => void;
  actions: ReturnType<typeof useItemActions>;
};

/**
 * ⌘K: finds items (server-ranked), runs actions and jumps to any view. The dialog's content is
 * mounted only while open, so the search text resets each time; the hooks that must outlive the
 * dialog (saving the clipboard, item actions) live out here.
 */
export function CommandPalette() {
  const t = useT().palette;
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const cursorId = useUiStore((state) => state.cursorId);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isGuest } = useViewer();
  const openItemParam = useOpenItem();
  const actions = useItemActions();
  const capture = useCapture(viewFromPath(pathname));

  const cursorItem = useMemo(
    // Read when the palette opens: the cache can change under a closed palette.
    () => (open ? findCachedItem(queryClient, cursorId) : null),
    [open, queryClient, cursorId],
  );

  const context: Context = {
    isGuest,
    cursorItem,
    actions,
    close: () => setOpen(false),
    openItem: (item) => {
      setOpen(false);
      openItemParam(item);
    },
    goTo: (href) => {
      setOpen(false);
      router.push(href);
    },
    saveClipboard: () => {
      setOpen(false);
      void (async () => {
        try {
          const found = await readClipboardRequests();
          if (found.requests.length === 0) toast(t.clipboardEmpty);
          else saveRequests(capture, found);
        } catch (error) {
          if (error instanceof ClipboardDeniedError) toast.error(t.clipboardDenied);
          else throw error;
        }
      })();
    },
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <PaletteBody {...context} />
    </CommandDialog>
  );
}

function PaletteBody({
  isGuest,
  cursorItem,
  actions,
  close,
  openItem,
  goTo,
  saveClipboard,
}: Context) {
  const messages = useT();
  const t = messages.palette;
  const client = useMemo(() => createClient(), []);
  const [text, setText] = useState("");
  const query = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  const { setQuickAddOpen, setUpgradeOpen, setShortcutDialog } = useUiStore.getState();

  const search = useQuery({
    // Not under ["items"]: a board mutation must not refetch or patch these.
    queryKey: ["palette-search", query],
    queryFn: () => searchItems(client, query, {}, RESULT_LIMIT),
    enabled: query !== "",
  });
  const collections = useQuery(collectionsQueryOptions(client)).data ?? [];
  const tags = useQuery(tagsQueryOptions(client)).data ?? [];
  const smartViews = useQuery(smartViewsQueryOptions(client)).data ?? [];

  // Results are for the text the debounce has caught up with.
  const settled = text.trim() === query;
  const results = settled && query !== "" ? (search.data ?? []) : [];
  const waiting = text.trim() !== "" && (!settled || search.isPending);
  const showEmpty = !waiting && results.length === 0;

  /** Closes the palette, then runs `action` with the store's setters. */
  const run = (action: () => void) => () => {
    close();
    action();
  };

  const itemActions = cursorItem
    ? [
        {
          key: "open",
          label: t.actions.open,
          hint: "Enter",
          onSelect: () => openItem(cursorItem),
        },
        {
          key: "favorite",
          label: cursorItem.is_favorite ? t.actions.unfavorite : t.actions.favorite,
          hint: "F",
          onSelect: run(() => void actions.toggleFavorite(cursorItem)),
        },
        {
          key: "archive",
          label: cursorItem.archived_at ? t.actions.unarchive : t.actions.archive,
          hint: "E",
          onSelect: run(() =>
            void (cursorItem.archived_at
              ? actions.unarchive(cursorItem)
              : actions.archive(cursorItem)),
          ),
        },
        {
          key: "trash",
          label: t.actions.trash,
          hint: "⌫",
          onSelect: run(() => void actions.trash(cursorItem)),
        },
        {
          key: "move",
          label: t.actions.moveTo,
          hint: "M",
          onSelect: run(() => setShortcutDialog("move")),
        },
        {
          key: "tag",
          label: t.actions.addTag,
          hint: "T",
          onSelect: run(() => setShortcutDialog("tag")),
        },
      ]
    : [];

  const names = t.go;
  const addEmail = messages.auth.guest.addEmail;
  const showResults = text.trim() !== "" && (results.length > 0 || waiting || search.isError);

  return (
    <>
      <CommandInput
        value={text}
        onValueChange={setText}
        placeholder={t.placeholder}
        data-palette-input=""
      />
      <CommandList>
        {showResults ? (
          // forceMount: the status lines below are not items, so cmdk would hide the group.
          <CommandGroup heading={t.groups.results} forceMount>
            {results.map((item) => (
              <CommandItem
                key={item.id}
                // Server-ranked: always shown, whatever cmdk's own text match says.
                forceMount
                value={`result ${item.id}`}
                onSelect={() => openItem(item)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {item.title ?? item.file_name ?? item.url ?? t.untitled}
                </span>
                {item.domain ? (
                  <span className="text-meta text-ink-subtle shrink-0">{item.domain}</span>
                ) : null}
              </CommandItem>
            ))}
            {waiting ? (
              <p role="status" className="text-meta text-ink-subtle px-2 py-2">
                {t.searching}
              </p>
            ) : null}
            {!waiting && search.isError ? (
              <p role="status" className="text-meta text-ink-subtle px-2 py-2">
                {t.searchFailed}
              </p>
            ) : null}
          </CommandGroup>
        ) : null}

        <CommandGroup heading={t.groups.actions}>
          <CommandItem
            value="add item"
            keywords={["new", "create", "quick add"]}
            onSelect={run(() => setQuickAddOpen(true))}
          >
            {t.actions.addItem}
          </CommandItem>
          <CommandItem
            value="save clipboard"
            keywords={["paste"]}
            onSelect={saveClipboard}
          >
            {t.actions.saveClipboard}
            <CommandShortcut>⌘V</CommandShortcut>
          </CommandItem>
          {isGuest ? (
            <CommandItem
              value="add email"
              keywords={["upgrade", "account", "sign in"]}
              onSelect={run(() => setUpgradeOpen(true))}
            >
              {addEmail}
            </CommandItem>
          ) : null}
          {itemActions.map((action) => (
            <CommandItem key={action.key} value={action.label} onSelect={action.onSelect}>
              {action.label}
              <CommandShortcut>{action.hint}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading={t.groups.goTo}>
          {GO_VIEWS.map(({ view, hint }) => (
            <CommandItem
              key={view}
              value={`go to ${names[view]}`}
              keywords={[view]}
              onSelect={() => goTo(viewHref({ type: view }))}
            >
              {names[view]}
              {hint ? <CommandShortcut>{hint}</CommandShortcut> : null}
            </CommandItem>
          ))}
          {collections.map((collection) => (
            <CommandItem
              key={collection.id}
              value={`go to collection ${collection.name} ${collection.id}`}
              onSelect={() => goTo(viewHref({ type: "collection", collectionId: collection.id }))}
            >
              {collection.emoji ? <span aria-hidden="true">{collection.emoji}</span> : null}
              {collection.name}
            </CommandItem>
          ))}
          {tags.map((tag) => (
            <CommandItem
              key={tag.id}
              value={`go to tag ${tag.name} ${tag.id}`}
              onSelect={() => goTo(viewHref({ type: "tag", tagId: tag.id }))}
            >
              #{tag.name}
            </CommandItem>
          ))}
          {smartViews.map((view) => (
            <CommandItem
              key={view.id}
              value={`go to smart view ${view.name} ${view.id}`}
              onSelect={() => goTo(viewHref({ type: "smart", viewId: view.id }))}
            >
              {view.name}
            </CommandItem>
          ))}
        </CommandGroup>
        {showEmpty ? <CommandEmpty>{t.empty}</CommandEmpty> : null}
      </CommandList>
    </>
  );
}
