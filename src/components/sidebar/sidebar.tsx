"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArchiveIcon,
  CircleDotIcon,
  InboxIcon,
  LayersIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { KindIcon } from "@/components/kind-icon";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
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
import { CollectionRow, TagRow } from "./manage-rows";
import { NavItem } from "./nav-item";
import { SignOutButton } from "./sign-out-button";

type SidebarProps = {
  /** Signed-in email, or null for a guest. */
  email: string | null;
  onNavigate?: () => void;
};

function Section({
  label,
  heading = true,
  action,
  children,
}: {
  label: string;
  /** Show the label as a visible heading. System groups are labelled for screen readers only. */
  heading?: boolean;
  /** A control at the right end of the heading, e.g. "New collection". */
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
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

export function Sidebar({ email, onNavigate }: SidebarProps) {
  const client = createClient();
  const { data: counts } = useQuery(countsQueryOptions(client));
  const { data: collections } = useQuery(collectionsQueryOptions(client));
  const { data: tags } = useQuery(tagsQueryOptions(client));
  const { data: smartViews } = useQuery(smartViewsQueryOptions(client));
  const [creatingCollection, setCreatingCollection] = useState(false);

  const kindsWithItems = ITEM_KINDS.filter((kind) => (counts?.kinds[kind] ?? 0) > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Logo />
      </div>

      <nav
        aria-label="Sidebar"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3"
      >
        <Section label="Views" heading={false}>
          <li>
            <NavItem
              href={viewHref({ type: "inbox" })}
              icon={<InboxIcon />}
              label="Inbox"
              count={counts?.inbox}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "all" })}
              icon={<LayersIcon />}
              label="All"
              count={counts?.all}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "unread" })}
              icon={<CircleDotIcon />}
              label="Unread"
              count={counts?.unread}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "favorites" })}
              icon={<StarIcon />}
              label="Favorites"
              count={counts?.favorites}
              onNavigate={onNavigate}
            />
          </li>
        </Section>

        {kindsWithItems.length > 0 ? (
          <>
            <Separator />
            <Section label="Formats">
              {kindsWithItems.map((kind) => (
                <li key={kind}>
                  <NavItem
                    href={viewHref({ type: "kind", kind })}
                    icon={<KindIcon kind={kind} />}
                    label={kindPluralLabel(kind)}
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
          label="Collections"
          action={
            <IconButton
              variant="ghost"
              size="sm"
              label="New collection"
              className="size-6"
              onClick={() => setCreatingCollection(true)}
            >
              <PlusIcon className="size-4" />
            </IconButton>
          }
        >
          {collections && collections.length > 0 ? (
            collections.map((collection) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                count={counts?.collections[collection.id]}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <li className="text-meta text-ink-subtle px-2.5 py-1">No collections yet</li>
          )}
        </Section>

        {tags && tags.length > 0 ? (
          <>
            <Separator />
            <Section label="Tags">
              {tags.map((tag) => (
                <TagRow key={tag.id} tag={tag} onNavigate={onNavigate} />
              ))}
            </Section>
          </>
        ) : null}

        {smartViews && smartViews.length > 0 ? (
          <>
            <Separator />
            <Section label="Smart views">
              {smartViews.map((smartView) => (
                <li key={smartView.id}>
                  <NavItem
                    href={viewHref({ type: "smart", viewId: smartView.id })}
                    icon={<SparklesIcon />}
                    label={smartView.name}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </Section>
          </>
        ) : null}

        <Separator />
        <Section label="Archive and trash" heading={false}>
          <li>
            <NavItem
              href={viewHref({ type: "archive" })}
              icon={<ArchiveIcon />}
              label="Archive"
              count={counts?.archive}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavItem
              href={viewHref({ type: "trash" })}
              icon={<Trash2Icon />}
              label="Trash"
              count={counts?.trash}
              onNavigate={onNavigate}
            />
          </li>
        </Section>
      </nav>

      <CollectionDialog open={creatingCollection} onOpenChange={setCreatingCollection} />

      <Separator />
      <div role="group" aria-label="Account" className="flex shrink-0 items-center gap-2 p-3">
        <p className="text-meta text-ink-muted min-w-0 flex-1 truncate" title={email ?? undefined}>
          {email ?? "Guest"}
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
