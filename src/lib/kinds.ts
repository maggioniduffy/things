import type { Messages } from "@/i18n/messages";
import type { ItemKind } from "@/types/supabase";

/** The kind labels of one locale: `useT().shell.kinds` in components. */
export type KindLabels = Messages["shell"]["kinds"];

export function kindSingularLabel(kinds: KindLabels, kind: ItemKind): string {
  return kinds[kind].singular;
}

export function kindPluralLabel(kinds: KindLabels, kind: ItemKind): string {
  return kinds[kind].plural;
}

/** Plural label for running text: lower case, except the PDFs acronym. */
export function kindPluralLowercase(kinds: KindLabels, kind: ItemKind): string {
  const plural = kinds[kind].plural;
  return kind === "pdf" ? plural : plural.toLowerCase();
}
