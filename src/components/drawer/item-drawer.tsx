"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSwipeToClose } from "@/hooks/use-swipe-to-close";
import { useT } from "@/i18n/client";
import { itemQueryOptions } from "@/lib/items/item-query";
import { useItemActions } from "@/lib/items/state-mutations";
import { kindSingularLabel } from "@/lib/kinds";
import { createClient } from "@/lib/supabase/client";
import type { ViewSpec } from "@/lib/views";
import { ItemActionBar } from "./actions";
import { CollectionField, TagsField, TitleField } from "./fields";
import { ITEM_PARAM, useCloseItem } from "./item-param";
import { ItemMetadata } from "./metadata";
import { ItemPreview } from "./previews";
import { safeHttpUrl } from "./urls";

function DrawerLoading() {
  const t = useT().items.drawer;
  return (
    <div className="grid gap-4 p-4" aria-busy="true">
      <DrawerTitle className="sr-only">{t.loading}</DrawerTitle>
      <Skeleton className="aspect-[4/3] w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function Unavailable({ onClose }: { onClose: () => void }) {
  const t = useT().items.drawer;
  return (
    <div className="grid justify-items-start gap-3 p-4">
      <DrawerTitle>{t.unavailableTitle}</DrawerTitle>
      <p className="text-body text-ink-muted">{t.unavailableBody}</p>
      <Button variant="secondary" onClick={onClose}>
        {t.close}
      </Button>
    </div>
  );
}

/** Contents of the open drawer: loads the item by id and renders preview, fields and actions. */
function DrawerBody({ id, view, onClose }: { id: string; view: ViewSpec; onClose: () => void }) {
  const t = useT().items.drawer;
  const card = useT().shell.card;
  const kinds = useT().shell.kinds;
  const query = useQuery(itemQueryOptions(createClient(), id));
  const actions = useItemActions();
  const item = query.data;

  // Opening an item marks it read, once per item.
  const markedRef = useRef<string | null>(null);
  const { markRead } = actions;
  useEffect(() => {
    if (!item || item.is_read || markedRef.current === item.id) return;
    markedRef.current = item.id;
    void markRead(item);
  }, [item, markRead]);

  if (!item) {
    if (query.isPending) return <DrawerLoading />;
    return <Unavailable onClose={onClose} />;
  }

  const sourceHref = safeHttpUrl(item.url);

  return (
    <>
      <div className="border-line flex items-center gap-2 border-b py-3 pr-3 pl-4">
        <Badge>{kindSingularLabel(kinds, item.kind)}</Badge>
        <span className="flex-1" />
        {sourceHref ? (
          <IconButton asChild variant="ghost" size="sm" label={t.openInNewTab}>
            <a href={sourceHref} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
            </a>
          </IconButton>
        ) : null}
        <DrawerClose asChild>
          <IconButton variant="ghost" size="sm" label={t.close} tooltip={false}>
            <XIcon />
          </IconButton>
        </DrawerClose>
      </div>
      <DrawerTitle className="sr-only">{itemDisplayTitle(item, card)}</DrawerTitle>

      {/* No dragging inside: the drawer closes with Esc, the Close button or the overlay. */}
      <div
        data-vaul-no-drag
        className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-4"
      >
        {/* A note's text is its main content: title above it; elsewhere the preview comes first. */}
        {item.kind === "note" ? (
          <>
            <TitleField item={item} actions={actions} />
            <ItemPreview item={item} actions={actions} />
          </>
        ) : (
          <>
            <ItemPreview item={item} actions={actions} />
            <TitleField item={item} actions={actions} />
          </>
        )}
        <CollectionField item={item} actions={actions} />
        <TagsField item={item} />
        <ItemMetadata item={item} />
      </div>

      <div className="border-line flex items-center gap-2 border-t p-4">
        <div className="min-w-0 flex-1">
          <ItemActionBar item={item} view={view} actions={actions} onClose={onClose} />
        </div>
        <Button variant="secondary" className="shrink-0 sm:hidden" onClick={onClose}>
          {t.close}
        </Button>
      </div>
    </>
  );
}

/**
 * The item detail drawer. `?item=<id>` is the source of truth: present opens it (also after a
 * reload), absent closes it. Wrap in <Suspense>: it reads the search params.
 */
export function ItemDrawerHost({ view }: { view: ViewSpec }) {
  const id = useSearchParams().get(ITEM_PARAM);
  const close = useCloseItem();
  const phone = useMediaQuery("(max-width: 639px)");
  const swipeRef = useSwipeToClose({ enabled: phone, onClose: close });

  // Keep the last id while the drawer slides out, so its content does not vanish mid-animation.
  const [shownId, setShownId] = useState(id);
  if (id && id !== shownId) setShownId(id);

  return (
    <Drawer
      direction="right"
      handleOnly
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DrawerContent
        ref={swipeRef}
        aria-describedby={undefined}
        data-testid="item-drawer"
        className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-xl"
      >
        {shownId ? <DrawerBody key={shownId} id={shownId} view={view} onClose={close} /> : null}
      </DrawerContent>
    </Drawer>
  );
}
