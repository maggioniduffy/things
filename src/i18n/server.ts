import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/** Locale for this request (cookie, then domain, then Accept-Language). */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    host: headerList.get("x-forwarded-host") ?? headerList.get("host"),
    acceptLanguage: headerList.get("accept-language"),
  });
}

/** Copy for this request, for server components and generateMetadata. */
export async function getT(): Promise<Messages> {
  return messages[await getLocale()];
}
