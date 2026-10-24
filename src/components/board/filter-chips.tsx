"use client";

import { useQuery } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n/client";
import type { BoardItem } from "@/lib/items/queries";
import { ITEM_KINDS } from "@/lib/views";
import { kindPluralLabel } from "@/lib/kinds";
import {
  NO_SEARCH,
  SEARCH_STATUSES,
  isEmptySearch,
  searchParamsHref,
  type BoardSearch,
} from "@/lib/search-params";
import { tagsQueryOptions } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";

type Chip = { key: string; label: string; remove: () => BoardSearch };

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

type FilterChipsProps = {
  /** The parsed URL state; the row is hidden while this is null (not searching). */
  search: BoardSearch | null;
  /** The results on screen: the domain filter offers the domains found in them. */
  items: readonly BoardItem[];
};

/**
 * The row under the toolbar while searching: one removable chip per active filter, an "Add
 * filter" menu (kind, tag, domain, status) and "Clear". Every change is written to the URL.
 */
export function FilterChips({ search, items }: FilterChipsProps) {
  const t = useT().shell;
  const s = t.search;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tags = useQuery({ ...tagsQueryOptions(createClient()), enabled: search !== null });

  if (!search) return null;

  function write(next: BoardSearch | null) {
    const target = next && !isEmptySearch(next) ? next : null;
    router.replace(searchParamsHref(pathname, searchParams, target), { scroll: false });
  }

  const current = search;
  const tagName = (id: string) => tags.data?.find((tag) => tag.id === id)?.name;
  const chips: Chip[] = [
    ...current.kinds.map((kind) => ({
      key: `kind:${kind}`,
      label: kindPluralLabel(t.kinds, kind),
      remove: () => ({ ...current, kinds: current.kinds.filter((entry) => entry !== kind) }),
    })),
    ...current.tagIds.map((id) => ({
      key: `tag:${id}`,
      label: tagName(id) ? `#${tagName(id)}` : t.rules.unknownTag,
      remove: () => ({ ...current, tagIds: current.tagIds.filter((entry) => entry !== id) }),
    })),
    ...current.domains.map((domain) => ({
      key: `domain:${domain}`,
      label: domain,
      remove: () => ({
        ...current,
        domains: current.domains.filter((entry) => entry !== domain),
      }),
    })),
    ...current.statuses.map((status) => ({
      key: `status:${status}`,
      label: s.statuses[status],
      remove: () => ({
        ...current,
        statuses: current.statuses.filter((entry) => entry !== status),
      }),
    })),
  ];

  const domains = [
    ...new Set([
      ...current.domains,
      ...items.flatMap((item) => (item.domain ? [item.domain] : [])),
    ]),
  ].sort();

  return (
    <div
      role="group"
      aria-label={s.filtersLabel}
      data-slot="filter-chips"
      className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          data-slot="filter-chip"
          className="bg-surface text-meta text-ink border-line inline-flex h-7 items-center gap-1 rounded-full border pr-1 pl-2.5 font-medium"
        >
          {chip.label}
          <button
            type="button"
            aria-label={s.removeFilter(chip.label)}
            onClick={() => write(chip.remove())}
            className="text-ink-subtle hover:text-ink hover:bg-accent focus-visible:outline-ring inline-flex size-5 items-center justify-center rounded-full focus-visible:outline-2"
          >
            <XIcon aria-hidden="true" className="size-3.5" />
          </button>
        </span>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <PlusIcon strokeWidth={2.75} />
            {s.addFilter}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{s.kind}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {ITEM_KINDS.map((kind) => (
                <DropdownMenuCheckboxItem
                  key={kind}
                  checked={current.kinds.includes(kind)}
                  onCheckedChange={() => write({ ...current, kinds: toggle(current.kinds, kind) })}
                >
                  {kindPluralLabel(t.kinds, kind)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{s.tag}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {tags.data && tags.data.length > 0 ? (
                tags.data.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={current.tagIds.includes(tag.id)}
                    onCheckedChange={() =>
                      write({ ...current, tagIds: toggle(current.tagIds, tag.id) })
                    }
                  >
                    #{tag.name}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuItem disabled>{s.noTags}</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{s.domain}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {domains.length > 0 ? (
                domains.map((domain) => (
                  <DropdownMenuCheckboxItem
                    key={domain}
                    checked={current.domains.includes(domain)}
                    onCheckedChange={() =>
                      write({ ...current, domains: toggle(current.domains, domain) })
                    }
                  >
                    {domain}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuItem disabled>{s.noDomains}</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{s.status}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SEARCH_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={current.statuses.includes(status)}
                  onCheckedChange={() =>
                    write({ ...current, statuses: toggle(current.statuses, status) })
                  }
                >
                  {s.statuses[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={() => write(NO_SEARCH)}>
        {s.clear}
      </Button>
    </div>
  );
}
