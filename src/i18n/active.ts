import { DEFAULT_LOCALE, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/**
 * The locale the browser is rendering in, for code outside React's render (mutation toasts, error
 * maps, drag announcements). Set by I18nProvider; English until then, which is also what unit
 * tests see. Never set on the server: that module state would be shared by concurrent requests.
 */
let active: Locale = DEFAULT_LOCALE;

const onServer = (): boolean => typeof window === "undefined";

export function setActiveLocale(locale: Locale) {
  if (onServer()) return;
  active = locale;
}

export function getActiveLocale(): Locale {
  return active;
}

/**
 * Copy for the active locale. Browser event handlers and callbacks only; while rendering use
 * `useT()` (client) or `getT()` (server). On the server it throws in development and falls back
 * to English in production.
 */
export function getActiveMessages(): Messages {
  if (onServer()) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("getActiveMessages() ran on the server; use useT()/getT()");
    }
    return messages[DEFAULT_LOCALE];
  }
  return messages[active];
}
