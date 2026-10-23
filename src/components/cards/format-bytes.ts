import { INTL_LOCALE, type Locale } from "@/i18n/config";

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** Human-readable file size: "812 B", "34 KB", "1.2 MB". Null for a missing or invalid size. */
export function formatBytes(bytes: number | null | undefined, locale: Locale): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // One decimal below 10 (1.2 MB), whole numbers above (34 KB); bytes are always whole.
  const text =
    unit === 0 || value >= 10
      ? Math.round(value).toString()
      : new Intl.NumberFormat(INTL_LOCALE[locale], {
          maximumFractionDigits: 1,
        }).format(Number(value.toFixed(1)));
  return `${text} ${UNITS[unit]}`;
}
