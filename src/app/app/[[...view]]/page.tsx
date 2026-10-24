import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Board } from "@/components/board/board";
import { itemsInfiniteQueryOptions } from "@/lib/items/queries";
import { parseSearchParams } from "@/lib/search-params";
import { makeQueryClient } from "@/lib/query-client";
import { createClient } from "@/lib/supabase/server";
import { parseSort, parseView } from "@/lib/views";

type PageProps = {
  params: Promise<{ view?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** One board for every view: /app, /app/all, /app/f/<kind>, /app/c/<id>, /app/t/<id>, /app/v/<id>. */
export default async function BoardPage({ params, searchParams }: PageProps) {
  const { view: segments } = await params;
  const view = parseView(segments);
  if (!view) notFound();

  const query = await searchParams;
  const sort = parseSort(query.sort);
  const search = parseSearchParams(query);

  const supabase = await createClient();
  const queryClient = makeQueryClient();
  // First page is fetched on the server and hydrated; a failure falls back to a client fetch.
  await queryClient
    .infiniteQuery(itemsInfiniteQueryOptions(supabase, view, sort, search))
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Board view={view} sort={sort} />
    </HydrationBoundary>
  );
}
