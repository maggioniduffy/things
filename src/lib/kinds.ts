import type { ItemKind } from "@/types/supabase";

export const KIND_LABELS: Record<ItemKind, { singular: string; plural: string }> = {
  link: { singular: "Link", plural: "Links" },
  article: { singular: "Article", plural: "Articles" },
  video: { singular: "Video", plural: "Videos" },
  image: { singular: "Image", plural: "Images" },
  pdf: { singular: "PDF", plural: "PDFs" },
  document: { singular: "Document", plural: "Documents" },
  note: { singular: "Note", plural: "Notes" },
  audio: { singular: "Audio", plural: "Audio" },
  code: { singular: "Code", plural: "Code" },
  other: { singular: "Other", plural: "Other" },
};

export function kindSingularLabel(kind: ItemKind): string {
  return KIND_LABELS[kind].singular;
}

export function kindPluralLabel(kind: ItemKind): string {
  return KIND_LABELS[kind].plural;
}

/** Plural label for running text: lower case, except the PDFs acronym. */
export function kindPluralLowercase(kind: ItemKind): string {
  const plural = KIND_LABELS[kind].plural;
  return kind === "pdf" ? plural : plural.toLowerCase();
}
