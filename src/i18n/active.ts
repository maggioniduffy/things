import { DEFAULT_LOCALE, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/**
 * The locale the client is rendering in, for code outside React (mutation toasts, error maps).
 * Set by I18nProvider; English until then, which is also what unit tests see.
 */
let active: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale) {
  active = locale;
}

export function getActiveLocale(): Locale {
  return active;
}

/** Copy for the active locale. Call it where the string is built, not at module scope. */
export function getActiveMessages(): Messages {
  return messages[active];
}
