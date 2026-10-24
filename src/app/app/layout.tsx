import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuestBanner } from "@/components/account/guest-banner";
import { UpgradeHost } from "@/components/account/upgrade-host";
import { AppShell } from "@/components/app-shell/app-shell";
import { TourHost } from "@/components/onboarding/tour-host";
import { ShortcutsHost } from "@/hooks/use-shortcuts";
import { CommandPalette } from "@/components/palette/command-palette";
import { QueryProvider } from "@/components/providers/query-provider";
import { ViewerProvider } from "@/components/providers/viewer-provider";
import { getT } from "@/i18n/server";
import { needsTour } from "@/lib/onboarding";
import { makeQueryClient } from "@/lib/query-client";
import {
  collectionsQueryOptions,
  countsQueryOptions,
  smartViewsQueryOptions,
  tagsQueryOptions,
} from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getT();
  return { title: meta.app.title, robots: { index: false } };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Re-evaluated on router.refresh(), so the banner leaves as soon as a guest upgrades.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // The proxy keeps signed-out users out of /app; this is a defensive fallback.
  if (!claims) redirect("/login");

  const isGuest = claims.is_anonymous === true;
  const email = !isGuest && typeof claims.email === "string" ? claims.email : null;

  // Sidebar data is prefetched on the server and hydrated, so the sidebar renders complete.
  // A failed prefetch is fine: the client query simply fetches on mount.
  const queryClient = makeQueryClient();
  await Promise.all([
    queryClient.query(countsQueryOptions(supabase)).catch(() => {}),
    queryClient.query(collectionsQueryOptions(supabase)).catch(() => {}),
    queryClient.query(tagsQueryOptions(supabase)).catch(() => {}),
    queryClient.query(smartViewsQueryOptions(supabase)).catch(() => {}),
  ]);

  return (
    <QueryProvider userId={claims.sub}>
      <ViewerProvider userId={claims.sub} isGuest={isGuest}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <div className="bg-paper flex h-dvh flex-col">
            {isGuest ? <GuestBanner /> : null}
            {isGuest ? <UpgradeHost /> : null}
            <TourHost needed={needsTour(claims.user_metadata)} />
            <AppShell email={email}>
              <ShortcutsHost />
              <CommandPalette />
              {children}
            </AppShell>
          </div>
        </HydrationBoundary>
      </ViewerProvider>
    </QueryProvider>
  );
}
