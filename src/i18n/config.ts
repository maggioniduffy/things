export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Set by the language switcher; overrides the domain default on this host. */
export const LOCALE_COOKIE = "locale";

/** Canonical origin per locale: Thingteca in English, Cosateca in Spanish. */
export const SITE_URL: Record<Locale, string> = {
  en: "https://thing.teca.plus",
  es: "https://cosa.teca.plus",
};

/** BCP 47 tag for Intl formatters. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-AR" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the locale for a request: the switcher cookie, then the domain (cosa. = es, thing. = en),
 * then the browser's first Accept-Language entry (localhost, previews), then English.
 */
export function resolveLocale({
  cookie,
  host,
  acceptLanguage,
}: {
  cookie?: string | null;
  host?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(cookie)) return cookie;
  const hostname = host?.toLowerCase() ?? "";
  if (hostname.startsWith("cosa.")) return "es";
  if (hostname.startsWith("thing.")) return "en";
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first === "es" || first.startsWith("es-")) return "es";
  return DEFAULT_LOCALE;
}
