"use client";

import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config";
import { focusRing } from "@/components/ui/focus-ring";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Remembers a signed-in user's choice so auth emails follow it. Best effort. */
async function saveToProfile(locale: Locale) {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.auth.updateUser({ data: { locale } });
  } catch {
    // The cookie already did the job.
  }
}

/**
 * Two-option language control. The choice is a cookie on this host (auth cookies are
 * host-scoped, so it never redirects to the other domain), then the page re-renders.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale();
  const { language } = useT().common;

  function choose(locale: Locale) {
    if (locale === current) return;
    writeLocaleCookie(locale);
    void saveToProfile(locale);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={language.label}
      className={cn(
        "rounded-control border-line bg-surface inline-flex gap-0.5 border p-0.5",
        className,
      )}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            onClick={() => choose(locale)}
            className={cn(
              "text-meta rounded-control px-2.5 py-1 font-medium",
              "ease-out-soft transition-[color,background-color] duration-(--duration-fast) motion-reduce:transition-none",
              active ? "bg-accent text-ink" : "text-ink-muted hover:text-ink",
              focusRing,
            )}
          >
            {language[locale]}
          </button>
        );
      })}
    </div>
  );
}
