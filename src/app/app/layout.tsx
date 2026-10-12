import type { Metadata } from "next";
import { GuestBanner } from "@/components/account/guest-banner";
import { Logo } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Things",
  robots: { index: false },
};

// Placeholder shell; the real sidebar and board arrive in Phase 2.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Re-evaluated on router.refresh(), so the banner leaves as soon as a guest upgrades.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isGuest = data?.claims?.is_anonymous === true;

  return (
    <div className="bg-paper flex min-h-dvh flex-col">
      <header className="border-line relative z-10 flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <Logo />
        <SignOutButton />
      </header>
      {isGuest ? <GuestBanner /> : null}
      {children}
    </div>
  );
}
