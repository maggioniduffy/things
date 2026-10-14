"use client";

import { createContext } from "react";
import type { BoardItem } from "@/lib/items/queries";

/**
 * What every node needs from the canvas, passed by context so node `data` stays just the item:
 * signed thumbnail URLs (one batch for the whole canvas) and the card callbacks.
 */
export type CanvasContextValue = {
  thumbnails: ReadonlyMap<string, string>;
  onOpen?: (item: BoardItem) => void;
  onRetry?: (item: BoardItem) => void | Promise<void>;
};

export const CanvasContext = createContext<CanvasContextValue>({ thumbnails: new Map() });
