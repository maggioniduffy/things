import { getActiveMessages } from "@/i18n/active";
import type { ItemKind } from "@/types/supabase";

/** Kind labels in the active language. Read at call time, so they follow the locale. */
export function kindLabels(): Record<ItemKind, { singular: string; plural: string }> {
  return getActiveMessages().shell.kinds;
}

export function kindSingularLabel(kind: ItemKind): string {
  return kindLabels()[kind].singular;
}

export function kindPluralLabel(kind: ItemKind): string {
  return kindLabels()[kind].plural;
}

/** Plural label for running text: lower case, except the PDFs acronym. */
export function kindPluralLowercase(kind: ItemKind): string {
  const plural = kindLabels()[kind].plural;
  return kind === "pdf" ? plural : plural.toLowerCase();
}
