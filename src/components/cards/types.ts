import type { BoardItem } from "@/lib/items/queries";

export type CardVariant = "grid" | "list";

/** Which card component renders an item: kinds without their own card share `file`. */
export type CardType = "link" | "video" | "image" | "pdf" | "note" | "file";

export type CardProps = {
  item: BoardItem;
  variant: CardVariant;
  /** Signed storage URL of the item's thumbnail; falls back to the unfurled `image_url`. */
  thumbnailUrl?: string | null;
  /** Called when the card is activated. The detail drawer wires this up in WP 4.2. */
  onOpen?: (item: BoardItem) => void;
  /** Called by the Retry button of a link whose details could not be fetched. */
  onRetry?: (item: BoardItem) => void | Promise<void>;
};
