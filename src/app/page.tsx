import { Aurora, Logo } from "@/components/brand";

// Placeholder to eyeball the brand pieces; WP 0.4 replaces it with the real landing page.
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 text-center">
      <Aurora variant="hero" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <h1 className="text-page">
          <Logo size={36} />
        </h1>
        <p className="text-body text-ink-muted">Save anything for later.</p>
      </div>
    </main>
  );
}
