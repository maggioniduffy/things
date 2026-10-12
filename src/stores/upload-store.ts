import { create } from "zustand";
import type { UploadProgress } from "@/lib/items/upload";

type UploadState = {
  /**
   * Progress of files being uploaded, by item id. An id that is present is uploading;
   * `null` means indeterminate (the standard upload has no progress events).
   */
  progress: Record<string, UploadProgress>;
  set: (itemId: string, progress: UploadProgress) => void;
  clear: (itemId: string) => void;
};

export const useUploadStore = create<UploadState>()((set) => ({
  progress: {},
  set: (itemId, progress) =>
    set((state) => ({ progress: { ...state.progress, [itemId]: progress } })),
  clear: (itemId) =>
    set((state) => {
      if (!(itemId in state.progress)) return state;
      const { [itemId]: _removed, ...rest } = state.progress;
      void _removed;
      return { progress: rest };
    }),
}));
