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
import { describeRules, parseRules } from "@/lib/filters";
import { effectiveSort } from "@/lib/items/queries";
import { kindPluralLabel } from "@/lib/kinds";
import {
  collectionsQueryOptions,
  smartViewsQueryOptions,
  tagsQueryOptions,
} from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";
import { SORT_MODES, type SortMode, type SystemView, type ViewSpec } from "@/lib/views";
import { useUiStore, type ViewMode } from "@/stores/ui-store";

const SYSTEM_TITLES: Record<SystemView, string> = {
  inbox: "Inbox",
  all: "All",
  unread: "Unread",
  favorites: "Favorites",
  archive: "Archive",
  trash: "Trash",
};

const SORT_LABELS: Record<SortMode, string> = {
  manual: "Manual",
  newest: "Newest",
  oldest: "Oldest",
  title: "Title",
};

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
  return parts.length > 0 ? parts.join(" · ") : "No rules: shows everything that isn't archived.";
}

/**
 * Title and existence of a view. Collections, tags and smart views come from the sidebar queries
 * (usually already hydrated); until they load, `title` is a generic word and `unknown` is false.
 */
export function useViewInfo(view: ViewSpec): ViewInfo {
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
      if (!collections.data) return { title: "Collection", name: null, unknown: false };
      const found = collections.data.find((collection) => collection.id === view.collectionId);
      if (!found) return { title: "Not found", name: null, unknown: true };
      return {
        title: found.emoji ? `${found.emoji} ${found.name}` : found.name,
        name: found.name,
        unknown: false,
      };
    }
    case "tag": {
      if (!tags.data) return { title: "Tag", name: null, unknown: false };
      const found = tags.data.find((tag) => tag.id === view.tagId);
      if (!found) return { title: "Not found", name: null, unknown: true };
      return { title: `#${found.name}`, name: found.name, unknown: false };
    }
    case "smart": {
      if (!smartViews.data) return { title: "Smart view", name: null, unknown: false };
      const found = smartViews.data.find((smartView) => smartView.id === view.viewId);
      if (!found) return { title: "Not found", name: null, unknown: true };
      return {
        title: found.icon ? `${found.icon} ${found.name}` : found.name,
        name: found.name,
        unknown: false,
        summary: found.invalidRules
          ? "These rules couldn't be read. Edit the smart view to fix them."
          : summarize(found.rules, collections.data, tags.data),
      };
    }
    default:
      return { title: SYSTEM_TITLES[view.type], name: null, unknown: false };
  }
}

/** The persisted mode, with canvas shown as grid until the canvas ships (Phase 6). */
export function useEffectiveViewMode(): Exclude<ViewMode, "canvas"> {
  const viewMode = useUiStore((state) => state.viewMode);
  return viewMode === "canvas" ? "grid" : viewMode;
}

function isSortMode(value: string): value is SortMode {
  return (SORT_MODES as readonly string[]).includes(value);
}

type ToolbarProps = { view: ViewSpec; sort: SortMode };

/** Reads `useSearchParams`, so render it inside a Suspense boundary. */
export function Toolbar({ view, sort }: ToolbarProps) {
  const { title, summary } = useViewInfo(view);
  const shownSort = effectiveSort(view, sort);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const viewMode = useEffectiveViewMode();
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
    <div className="bg-paper/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 px-4 backdrop-blur-md sm:gap-3 sm:px-6">
      <IconButton
        variant="ghost"
        size="sm"
        label="Open sidebar"
        className="md:hidden"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <MenuIcon />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
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
        placeholder="Search"
        aria-label="Search"
        className="hidden w-56 sm:block"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" aria-label={`Sort: ${SORT_LABELS[shownSort]}`}>
            <ArrowUpDownIcon />
            <span className="hidden sm:inline">{SORT_LABELS[shownSort]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={shownSort} onValueChange={changeSort}>
            {/* Smart views are filters, not places: nothing to order by hand. */}
            {SORT_MODES.filter((mode) => mode !== "manual" || view.type !== "smart").map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div role="group" aria-label="View" className="flex items-center gap-1">
        <IconButton
          variant={viewMode === "grid" ? "outline" : "ghost"}
          size="sm"
          label="Grid view"
          aria-pressed={viewMode === "grid"}
          onClick={() => setViewMode("grid")}
        >
          <LayoutGridIcon />
        </IconButton>
        <IconButton
          variant={viewMode === "list" ? "outline" : "ghost"}
          size="sm"
          label="List view"
          aria-pressed={viewMode === "list"}
          onClick={() => setViewMode("list")}
        >
          <ListIcon />
        </IconButton>
        {/* aria-disabled instead of disabled: the button stays focusable and hoverable, so the
            tooltip explains why canvas isn't available yet. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              variant="ghost"
              size="sm"
              label="Canvas view"
              tooltip={false}
              aria-disabled="true"
              className="cursor-not-allowed opacity-50"
              onClick={(event) => event.preventDefault()}
            >
              <FrameIcon />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>Canvas is coming soon</TooltipContent>
        </Tooltip>
      </div>

      <Button size="sm" aria-label="Add" onClick={() => setQuickAddOpen(true)}>
        <PlusIcon />
        <span className="hidden sm:inline">Add</span>
      </Button>
    </div>
  );
}
