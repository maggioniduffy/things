import { create } from "zustand";

/** One copied card: its top-left relative to the top-left of the copied cards' bounding box. */
export type ClipboardEntry = { id: string; dx: number; dy: number };

/**
 * What ⌘C on the canvas keeps in the app. Not persisted: it lives as long as the tab.
 * `text` is what went to the system clipboard, so a later paste can tell it is still ours.
 */
export type CanvasClipboard = {
  entries: ClipboardEntry[];
  text: string;
  /** Size of the bounding box, in flow units; a paste centers this box on the cursor. */
  width: number;
  height: number;
};

type CanvasClipboardState = {
  clipboard: CanvasClipboard | null;
  setClipboard: (clipboard: CanvasClipboard | null) => void;
};

export const useCanvasClipboard = create<CanvasClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (clipboard) => set({ clipboard }),
}));
