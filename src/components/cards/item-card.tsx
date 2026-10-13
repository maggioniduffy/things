"use client";

import type { ItemKind } from "@/types/supabase";
import { FileCard } from "./file-card";
import { ImageCard } from "./image-card";
import { LinkCard } from "./link-card";
import { NoteCard } from "./note-card";
import { PdfCard } from "./pdf-card";
import type { CardProps, CardType } from "./types";
import { VideoCard } from "./video-card";

const CARD_TYPE: Record<ItemKind, CardType> = {
  link: "link",
  article: "link",
  video: "video",
  image: "image",
  pdf: "pdf",
  note: "note",
  document: "file",
  audio: "file",
  code: "file",
  other: "file",
};

export function cardTypeFor(kind: ItemKind): CardType {
  return CARD_TYPE[kind];
}

/** Picks the card for an item's kind. Renders an `<li>`, so it must sit inside a `<ul>`. */
export function ItemCard(props: CardProps) {
  switch (cardTypeFor(props.item.kind)) {
    case "link":
      return <LinkCard {...props} />;
    case "video":
      return <VideoCard {...props} />;
    case "image":
      return <ImageCard {...props} />;
    case "pdf":
      return <PdfCard {...props} />;
    case "note":
      return <NoteCard {...props} />;
    case "file":
      return <FileCard {...props} />;
  }
}
