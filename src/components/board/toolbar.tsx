"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDownIcon,
  FrameIcon,
  LayoutGridIcon,
  ListIcon,
  MenuIcon,
  PanelLeftIcon,
  PlusIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/i18n/client";
import { getActiveMessages } from "@/i18n/active";
import { describeRules, parseRules } from "@/lib/filters";
import { effectiveSort } from "@/lib/items/queries";
import { kindPluralLabel } from "@/lib/kinds";
import {
  collectionsQueryOptions,
  smartViewsQueryOptions,
  tagsQueryOptions,
} from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { SORT_MODES, type SortMode, type ViewSpec } from "@/lib/views";
import { useUiStore, type ViewMode } from "@/stores/ui-store";

export type ViewInfo = {
  /** Heading text. */
  title: string;
  /** Collection, tag or smart view name once known. */
  name: string | null;
  /** The collection, tag or smart view is not in the loaded sidebar data. */
  unknown: boolean;
  /** Smart views: a short plain-language summary of the rules. */
  summary?: string | null;
};

/** "Kind: PDFs · Unread", or a line saying there are no rules yet. */
function summarize(
  rules: Parameters<typeof describeRules>[0] | undefined,
  collections: readonly { id: string; name: string }[] | undefined,
  tags: readonly { id: string; name: string }[] | undefined,
): string {
  const parts = describeRules(parseRules(rules ?? {}).rules, {
    collections: collections ?? [],
    tags: tags ?? [],
  });
  return parts.length > 0 ? parts.join(" · ") : getActiveMessages().shell.rules.none;
}

/**
 * Title and existence of a view. Collections, tags and smart views come from the sidebar queries
 * (usually already hydrated); until they load, `title` is a generic word and `unknown` is false.
 */
export function useViewInfo(view: ViewSpec): ViewInfo {
  const t = useT().shell;
  const client = createClient();
  const collections = useQuery({
    ...collectionsQueryOptions(client),
    enabled: view.type === "collection" || view.type === "smart",
  });
  const tags = useQuery({
    ...tagsQueryOptions(client),
    enabled: view.type === "tag" || view.type === "smart",
  });
  const smartViews = useQuery({
    ...smartViewsQueryOptions(client),
    enabled: view.type === "smart",
  });

  switch (view.type) {
    case "kind":
      return { title: kindPluralLabel(view.kind), name: null, unknown: false };
    case "collection": {
      if (!collections.data) return { title: t.toolbar.collection, name: null, unknown: false };
      const found = collections.data.find((collection) => collection.id === view.collectionId);
      if (!found) return { title: t.toolbar.notFound, name: null, unknown: true };
      return {
        title: found.emoji ? `${found.emoji} ${found.name}` : found.name,
        name: found.name,
        unknown: false,
      };
    }
    case "tag": {
      if (!tags.data) return { title: t.toolbar.tag, name: null, unknown: false };
      const found = tags.data.find((tag) => tag.id === view.tagId);
      if (!found) return { title: t.toolbar.notFound, name: null, unknown: true };
      return { title: `#${found.name}`, name: found.name, unknown: false };
    }
    case "smart": {
      if (!smartViews.data) return { title: t.toolbar.smartView, name: null, unknown: false };
      const found = smartViews.data.find((smartView) => smartView.id === view.viewId);
      if (!found) return { title: t.toolbar.notFound, name: null, unknown: true };
      return {
        title: found.icon ? `${found.icon} ${found.name}` : found.name,
        name: found.name,
        unknown: false,
        summary: found.invalidRules
          ? t.rules.unreadable
          : summarize(found.rules, collections.data, tags.data),
      };
    }
    default:
      return { title: t.views[view.type], name: null, unknown: false };
  }
}

/** Only the Inbox and collections are places with a canvas; other views are filters. */
export function hasCanvas(view: ViewSpec): boolean {
  return view.type === "inbox" || view.type === "collection";
}

/**
 * The persisted mode, with canvas shown as grid on views that have none. The persisted mode stays
 * "canvas", so returning to a collection shows the canvas again.
 */
export function useEffectiveViewMode(view: ViewSpec): ViewMode {
  const viewMode = useUiStore((state) => state.viewMode);
  return viewMode === "canvas" && !hasCanvas(view) ? "grid" : viewMode;
}

function isSortMode(value: string): value is SortMode {
  return (SORT_MODES as readonly string[]).includes(value);
}

type ToolbarProps = { view: ViewSpec; sort: SortMode };

/** Reads `useSearchParams`, so render it inside a Suspense boundary. */
export function Toolbar({ view, sort }: ToolbarProps) {
  const t = useT().shell;
  const tb = t.toolbar;
  const { title, summary } = useViewInfo(view);
  const shownSort = effectiveSort(view, sort);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const viewMode = useEffectiveViewMode(view);
  const canvasAvailable = hasCanvas(view);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setMobileSidebarOpen = useUiStore((state) => state.setMobileSidebarOpen);
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen);

  function changeSort(next: string) {
    if (!isSortMode(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "manual") params.delete("sort");
    else params.set("sort", next);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="bg-paper sm:bg-paper/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 px-4 backdrop-blur-md sm:gap-3 sm:px-6">
      <IconButton
        variant="ghost"
        size="sm"
        label={tb.openSidebar}
        className="md:hidden"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <MenuIcon />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        label={sidebarCollapsed ? tb.showSidebar : tb.hideSidebar}
        className="hidden md:inline-flex"
        onClick={toggleSidebar}
      >
        <PanelLeftIcon />
      </IconButton>

      <div className="min-w-0 flex-1">
        <h1 className="font-heading text-section tracking-heading truncate font-semibold">
          {title}
        </h1>
        {summary ? (
          <p data-slot="rules-summary" className="text-meta text-ink-subtle truncate">
            {summary}
          </p>
        ) : null}
      </div>

      <SearchField
        disabled
        hint={null}
        placeholder={tb.search}
        aria-label={tb.search}
        className="hidden w-56 sm:block"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" aria-label={tb.sortBy(tb.sort[shownSort])}>
            <ArrowUpDownIcon />
            <span className="hidden sm:inline">{tb.sort[shownSort]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={shownSort} onValueChange={changeSort}>
            {/* Smart views are filters, not places: nothing to order by hand. */}
            {SORT_MODES.filter((mode) => mode !== "manual" || view.type !== "smart").map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                {tb.sort[mode]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div role="group" aria-label={tb.viewGroup} className="flex items-center gap-1">
        <IconButton
          variant={viewMode === "grid" ? "outline" : "ghost"}
          size="sm"
          label={tb.gridView}
          aria-pressed={viewMode === "grid"}
          onClick={() => setViewMode("grid")}
        >
          <LayoutGridIcon />
        </IconButton>
        <IconButton
          variant={viewMode === "list" ? "outline" : "ghost"}
          size="sm"
          label={tb.listView}
          aria-pressed={viewMode === "list"}
          onClick={() => setViewMode("list")}
        >
          <ListIcon />
        </IconButton>
        {/* Where there is no canvas, aria-disabled instead of disabled: the button stays focusable
            and hoverable, so the tooltip explains why. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              variant={viewMode === "canvas" ? "outline" : "ghost"}
              size="sm"
              label={tb.canvasView}
              tooltip={false}
              aria-pressed={canvasAvailable ? viewMode === "canvas" : undefined}
              aria-disabled={canvasAvailable ? undefined : "true"}
              className={canvasAvailable ? undefined : "cursor-not-allowed opacity-50"}
              onClick={(event) => {
                if (!canvasAvailable) event.preventDefault();
                else setViewMode("canvas");
              }}
            >
              <FrameIcon />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>{canvasAvailable ? tb.canvasView : tb.canvasUnavailable}</TooltipContent>
        </Tooltip>
      </div>

      <Button size="sm" aria-label={tb.add} onClick={() => setQuickAddOpen(true)}>
        <PlusIcon />
        <span className="hidden sm:inline">{tb.add}</span>
      </Button>
    </div>
  );
}
