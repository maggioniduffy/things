import { BoardSkeleton, ToolbarPlaceholder } from "@/components/board/board-skeleton";

/** Shown immediately on client navigations while the next view's page streams in. */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <ToolbarPlaceholder />
      <BoardSkeleton />
    </div>
  );
}
