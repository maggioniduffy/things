import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type ViewMode = "grid" | "list" | "canvas";

type UiState = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /** Canvas minimap shown or hidden. */
  canvasMinimap: boolean;
  toggleCanvasMinimap: () => void;

  /** Canvas snaps dragged and placed cards to an 8 px grid. */
  canvasSnap: boolean;
  /** Canvas pointer: select (marquee, move cards) or hand (drag anywhere pans). */
  canvasTool: "select" | "hand";
  setCanvasTool: (tool: "select" | "hand") => void;
  toggleCanvasSnap: () => void;

  /** Collections whose folder is open in the All grid. Default (absent) is closed. */
  expandedCollections: string[];
  toggleCollectionExpanded: (collectionId: string) => void;

  selectedIds: string[];
  /** The last card clicked without Shift: where a Shift-click range starts. */
  anchorId: string | null;
  /** Replaces the selection with `id`, or adds it when `additive` is set. Sets the anchor. */
  select: (id: string, options?: { additive?: boolean }) => void;
  /** Adds or removes `id`. Sets the anchor. */
  toggle: (id: string) => void;
  /**
   * Selects the cards from the anchor to `toId`, both included, taking their order from
   * `orderedIds` (what is on screen). Replaces the selection, or extends it when `additive` is
   * set. Without a usable anchor it selects `toId` alone. The anchor stays put.
   */
  selectRange: (
    orderedIds: readonly string[],
    toId: string,
    options?: { additive?: boolean },
  ) => void;
  clearSelection: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  /** The "Add" dialog; the toolbar button and the Phase 7 palette open it. */
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
};

export const UI_STORE_KEY = "things-ui";

// localStorage can be missing or throw (private mode, blocked site data, SSR), so every access
// is guarded; the store then simply behaves as in-memory state.
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),

      canvasMinimap: false,
      toggleCanvasMinimap: () => set((state) => ({ canvasMinimap: !state.canvasMinimap })),

      canvasTool: "select",
      setCanvasTool: (tool) => set({ canvasTool: tool }),

      canvasSnap: false,
      toggleCanvasSnap: () => set((state) => ({ canvasSnap: !state.canvasSnap })),

      expandedCollections: [],
      toggleCollectionExpanded: (collectionId) =>
        set((state) => ({
          expandedCollections: state.expandedCollections.includes(collectionId)
            ? state.expandedCollections.filter((id) => id !== collectionId)
            : [...state.expandedCollections, collectionId],
        })),

      selectedIds: [],
      anchorId: null,
      select: (id, options) =>
        set((state) => ({
          anchorId: id,
          selectedIds: options?.additive
            ? state.selectedIds.includes(id)
              ? state.selectedIds
              : [...state.selectedIds, id]
            : [id],
        })),
      toggle: (id) =>
        set((state) => ({
          anchorId: id,
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((selected) => selected !== id)
            : [...state.selectedIds, id],
        })),
      selectRange: (orderedIds, toId, options) =>
        set((state) => {
          const to = orderedIds.indexOf(toId);
          if (to === -1) return state;
          const from = state.anchorId === null ? -1 : orderedIds.indexOf(state.anchorId);
          if (from === -1) return { anchorId: toId, selectedIds: [toId] };
          const range = orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1);
          const kept = options?.additive
            ? state.selectedIds.filter((id) => !range.includes(id))
            : [];
          return { selectedIds: [...kept, ...range] };
        }),
      clearSelection: () =>
        set((state) =>
          state.selectedIds.length || state.anchorId !== null
            ? { selectedIds: [], anchorId: null }
            : state,
        ),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),

      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

      quickAddOpen: false,
      setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
    }),
    {
      name: UI_STORE_KEY,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        canvasMinimap: state.canvasMinimap,
        canvasSnap: state.canvasSnap,
        canvasTool: state.canvasTool,
        expandedCollections: state.expandedCollections,
      }),
      // Keep the server and first client render identical; rehydrate in an effect instead.
      skipHydration: true,
    },
  ),
);

/** Call once in a client component near the root of /app to restore the persisted view mode. */
export function useRehydrateUiStore(): void {
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);
}
