"use client";

import { createContext, useContext } from "react";
import { setActiveLocale } from "./active";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { messages, type Messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Makes the request's locale available to client components. Takes only the locale: the
 * dictionaries hold functions, which cannot cross the server/client boundary as props.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  setActiveLocale(locale);
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Copy for the current locale. Without a provider (unit tests) this is English. */
export function useT(): Messages {
  return messages[useContext(LocaleContext)];
}
