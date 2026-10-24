import type { Locale } from "../config";
import { auth as enAuth } from "./en/auth";
import { common as enCommon } from "./en/common";
import { items as enItems } from "./en/items";
import { marketing as enMarketing } from "./en/marketing";
import { meta as enMeta } from "./en/meta";
import { palette as enPalette } from "./en/palette";
import { shell as enShell } from "./en/shell";
import { auth as esAuth } from "./es/auth";
import { common as esCommon } from "./es/common";
import { items as esItems } from "./es/items";
import { marketing as esMarketing } from "./es/marketing";
import { meta as esMeta } from "./es/meta";
import { palette as esPalette } from "./es/palette";
import { shell as esShell } from "./es/shell";

/**
 * One namespace per area: common (brand, shared words), meta (titles, OG), marketing (landing,
 * footer), auth (login, OTP, guest, upgrade, emails), shell (app shell, sidebar, board, cards,
 * toolbar), items (drawer, capture, canvas, item mutations and their toasts), palette (⌘K).
 * Values are strings or functions for counts/interpolation.
 */
const en = {
  common: enCommon,
  meta: enMeta,
  marketing: enMarketing,
  auth: enAuth,
  shell: enShell,
  items: enItems,
  palette: enPalette,
};

export type Messages = typeof en;

export const messages: Record<Locale, Messages> = {
  en,
  es: {
    common: esCommon,
    meta: esMeta,
    marketing: esMarketing,
    auth: esAuth,
    shell: esShell,
    items: esItems,
    palette: esPalette,
  },
};
