import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Things",
  robots: { index: false },
};

// Placeholder shell; the real sidebar and board arrive in Phase 2.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper flex min-h-dvh flex-col">
      <header className="border-line relative z-10 flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <Logo />
        <SignOutButton />
      </header>
      {children}
    </div>
  );
}
