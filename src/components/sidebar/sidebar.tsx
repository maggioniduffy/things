"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArchiveIcon,
  CircleDotIcon,
  CoffeeIcon,
  InboxIcon,
  LayersIcon,
  PanelLeftIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { SIDEBAR_ZONE_ATTRIBUTE } from "@/components/dnd/collision";
import { archiveTarget, favoritesTarget, inboxTarget, trashTarget } from "@/components/dnd/targets";
import { KindIcon } from "@/components/kind-icon";
import { focusRing } from "@/components/ui/focus-ring";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { kindPluralLabel } from "@/lib/kinds";
import {
  collectionsQueryOptions,
  countsQueryOptions,
  smartViewsQueryOptions,
  tagsQueryOptions,
} from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { ITEM_KINDS, viewHref } from "@/lib/views";
import { CollectionDialog } from "./collection-dialog";
import { CollectionRow, SmartViewRow, TagRow } from "./manage-rows";
import { NavItem } from "./nav-item";
import { SettingsMenu } from "./settings-menu";
import { SmartViewDialog } from "./smart-view-dialog";
import { SortableRows } from "./sortable-rows";

type SidebarProps = {
  /** Signed-in email, or null for a guest. */
  email: string | null;
  onNavigate?: () => void;
  /** Hides the sidebar (collapses it on desktop, closes the drawer on mobile). */
  onClose?: () => void;
};

function Section({
  label,
  heading = true,
  action,
  tour,
  children,
}: {
  label: string;
  /** Marks the section as a tour target. */
  tour?: string;
  /** Show the label as a visible heading. System groups are labelled for screen readers only. */
  heading?: boolean;
  /** A control at the right end of the heading, e.g. "New collection". */
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1" data-tour={tour}>
      {heading ? (
        <div className="flex items-center justify-between pr-1">
          <h2 id={id} className="text-meta text-ink-subtle px-2.5 pt-1 pb-0.5 font-medium">
            {label}
          </h2>
          {action}
        </div>
      ) : null}
      <ul
        aria-labelledby={heading ? id : undefined}
        aria-label={heading ? undefined : label}
        className="flex flex-col gap-0.5"
      >
        {children}
      </ul>
    </div>
  );
}

export function Sidebar({ email, onNavigate, onClose }: SidebarProps) {
  const t = useT().shell;
  const client = createClient();
  const { data: counts } = useQuery(countsQueryOptions(client));
  const { data: collections } = useQuery(collectionsQueryOptions(client));
  const { data: tags } = useQuery(tagsQueryOptions(client));
  const { data: smartViews } = useQuery(smartViewsQueryOptions(client));
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [creatingSmartView, setCreatingSmartView] = useState(false);

  const kindsWithItems = ITEM_KINDS.filter((kind) => (counts?.kinds[kind] ?? 0) > 0);

  return (
    <div className="flex h-full min-h-0 flex-col" {...{ [SIDEBAR_ZONE_ATTRIBUTE]: "" }}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-4">
        {onClose ? (
          // A pointer shortcut; the icon button next to it is the labelled, focusable control.
          <button type="button" tabIndex={-1} onClick={onClose} className="flex cursor-pointer">
            <Logo />
          </button>
        ) : (
          <Logo />
        )}
        {onClose ? (
          <IconButton variant="ghost" size="sm" label={t.toolbar.hideSidebar} onClick={onClose}>
            <PanelLeftIcon />
          </IconButton>
        ) : null}
      </div>

      <nav
        aria-label={t.sidebar.navLabel}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3"
      >
        <Section label={t.sidebar.views} heading={false}>
          <li>
            <NavItem
              href={viewHref({ type: "inbox" })}
              icon={<InboxIcon />}
              label={t.views.inbox}
              count={counts?.inbox}
              drop={inboxTarget(t.views)}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "all" })}
              icon={<LayersIcon />}
              label={t.views.all}
              count={counts?.all}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "unread" })}
              icon={<CircleDotIcon />}
              label={t.views.unread}
              count={counts?.unread}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "favorites" })}
              icon={<StarIcon />}
              label={t.views.favorites}
              count={counts?.favorites}
              drop={favoritesTarget(t.views)}
              onNavigate={onNavigate}
            />
          </li>
        </Section>

        {kindsWithItems.length > 0 ? (
          <>
            <Separator />
            <Section label={t.sidebar.formats}>
              {kindsWithItems.map((kind) => (
                <li key={kind}>
                  <NavItem
                    href={viewHref({ type: "kind", kind })}
                    icon={<KindIcon kind={kind} />}
                    label={kindPluralLabel(t.kinds, kind)}
                    count={counts?.kinds[kind]}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </Section>
          </>
        ) : null}

        <Separator />
        <Section
          label={t.sidebar.collections}
          tour="collections"
          action={
            <IconButton
              variant="ghost"
              size="sm"
              label={t.sidebar.newCollection}
              className="size-6"
              onClick={() => setCreatingCollection(true)}
            >
              <PlusIcon className="size-4" strokeWidth={2.75} />
            </IconButton>
          }
        >
          {collections && collections.length > 0 ? (
            <SortableRows section="collections" rows={collections}>
              {(shown) =>
                shown.map((collection) => (
                  <CollectionRow
                    key={collection.id}
                    collection={collection}
                    count={counts?.collections[collection.id]}
                    onNavigate={onNavigate}
                  />
                ))
              }
            </SortableRows>
          ) : (
            <li className="text-meta text-ink-subtle px-2.5 py-1">{t.sidebar.noCollections}</li>
          )}
        </Section>

        {tags && tags.length > 0 ? (
          <>
            <Separator />
            <Section label={t.sidebar.tags}>
              {tags.map((tag) => (
                <TagRow key={tag.id} tag={tag} onNavigate={onNavigate} />
              ))}
            </Section>
          </>
        ) : null}

        <Separator />
        <Section
          label={t.sidebar.smartViews}
          action={
            <IconButton
              variant="ghost"
              size="sm"
              label={t.sidebar.newSmartView}
              className="size-6"
              onClick={() => setCreatingSmartView(true)}
            >
              <PlusIcon className="size-4" strokeWidth={2.75} />
            </IconButton>
          }
        >
          {smartViews && smartViews.length > 0 ? (
            <SortableRows section="smart-views" rows={smartViews}>
              {(shown) =>
                shown.map((smartView) => (
                  <SmartViewRow key={smartView.id} smartView={smartView} onNavigate={onNavigate} />
                ))
              }
            </SortableRows>
          ) : (
            <li className="text-meta text-ink-subtle px-2.5 py-1">{t.sidebar.noSmartViews}</li>
          )}
        </Section>

        <Separator />
        <Section label={t.sidebar.archiveAndTrash} heading={false}>
          <li>
            <NavItem
              href={viewHref({ type: "archive" })}
              icon={<ArchiveIcon />}
              label={t.views.archive}
              count={counts?.archive}
              drop={archiveTarget(t.views)}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "trash" })}
              icon={<Trash2Icon />}
              label={t.views.trash}
              count={counts?.trash}
              drop={trashTarget(t.views)}
              onNavigate={onNavigate}
            />
          </li>
        </Section>
      </nav>

      <CollectionDialog open={creatingCollection} onOpenChange={setCreatingCollection} />
      <SmartViewDialog open={creatingSmartView} onOpenChange={setCreatingSmartView} />

      <Separator />
      <div className="flex shrink-0 items-center gap-1 p-2">
        <SettingsMenu email={email} onNavigate={onNavigate} />
        <a
          href={t.sidebar.cafecitoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-meta text-ink-muted hover:text-ink rounded-control flex min-w-0 items-center gap-2 px-2 py-1.5",
            "hover:bg-accent transition-colors duration-(--duration-fast) motion-reduce:transition-none",
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className="bg-aurora-coral/30 text-aurora-red rounded-control flex size-6 shrink-0 items-center justify-center"
          >
            <CoffeeIcon className="size-3.5" />
          </span>
          <span className="truncate">{t.sidebar.cafecito}</span>
        </a>
      </div>
    </div>
  );
}
