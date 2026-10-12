import { redirect } from "next/navigation";
import { Aurora } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // The proxy keeps signed-out users out of /app; this is a defensive fallback.
  if (!claims) redirect("/login");

  const email = typeof claims.email === "string" ? claims.email : null;
  const status = claims.is_anonymous || !email ? "Guest session" : `Signed in as ${email}`;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-4 text-center">
      <Aurora variant="subtle" />
      <p className="text-meta text-ink-subtle relative">{status}</p>
      <h1 className="font-heading text-page tracking-heading relative">Drop anything here.</h1>
    </main>
  );
}
