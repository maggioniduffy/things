import { Skeleton } from "@/components/ui/skeleton";

/** Same footprint as the toolbar: use while the real one cannot render yet. */
export function ToolbarPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6"
      data-slot="toolbar-placeholder"
    >
      <Skeleton className="size-8" />
      <Skeleton className="h-6 w-32" />
      <div className="flex-1" />
      <Skeleton className="hidden h-8 w-56 sm:block" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

const TILE_COUNT = 8;

/** Tile placeholders in the grid layout. */
export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your things"
      className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 px-4 pb-8 sm:px-6"
    >
      {Array.from({ length: TILE_COUNT }, (_, index) => (
        <Skeleton key={index} className="rounded-card h-32" />
      ))}
    </div>
  );
}
