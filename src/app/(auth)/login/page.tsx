import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sign in — Things",
  robots: { index: false },
};

// Placeholder until Phase 1 (email OTP, Google, guest sign-in).
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <h1 className="font-heading text-page tracking-heading">Sign-in is coming soon</h1>
      <p className="text-body text-ink-muted">Accounts and guest mode arrive in the next update.</p>
      <Button asChild variant="secondary">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
