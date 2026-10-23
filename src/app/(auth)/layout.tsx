import Link from "next/link";
import { Aurora, Logo } from "@/components/brand";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";

/** Auth pages: paper, a low aurora, the logo on top and a centered card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <Aurora variant="hero" className="h-[min(52vh,520px)]" />
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" aria-label="Thingteca, home" className={cn("rounded-control", focusRing)}>
          <Logo />
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-4 pb-[clamp(3rem,12vh,8rem)]">
        <div className="border-line bg-surface rounded-card w-full max-w-sm border p-6 backdrop-blur-md sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
