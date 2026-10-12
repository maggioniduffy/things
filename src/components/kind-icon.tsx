import {
  CodeIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  MusicIcon,
  NewspaperIcon,
  ShapesIcon,
  StickyNoteIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import type { ItemKind } from "@/types/supabase";

export const KIND_ICONS: Record<ItemKind, LucideIcon> = {
  link: LinkIcon,
  article: NewspaperIcon,
  video: VideoIcon,
  image: ImageIcon,
  pdf: FileTextIcon,
  document: FileIcon,
  note: StickyNoteIcon,
  audio: MusicIcon,
  code: CodeIcon,
  other: ShapesIcon,
};

export function KindIcon({ kind, className }: { kind: ItemKind; className?: string }) {
  const Icon = KIND_ICONS[kind];
  return <Icon aria-hidden="true" className={className} />;
}
