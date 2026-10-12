import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type ViewMode = "grid" | "list" | "canvas";

type UiState = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  selectedIds: string[];
  /** Replaces the selection with `id`, or adds it when `additive` is set. */
  select: (id: string, options?: { additive?: boolean }) => void;
  toggle: (id: string) => void;
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

      selectedIds: [],
      select: (id, options) =>
        set((state) => ({
          selectedIds: options?.additive
            ? state.selectedIds.includes(id)
              ? state.selectedIds
              : [...state.selectedIds, id]
            : [id],
        })),
      toggle: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((selected) => selected !== id)
            : [...state.selectedIds, id],
        })),
      clearSelection: () =>
        set((state) => (state.selectedIds.length ? { selectedIds: [] } : state)),

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
      partialize: (state) => ({ viewMode: state.viewMode }),
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
