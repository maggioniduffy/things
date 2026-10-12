"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type Viewer = { userId: string; isGuest: boolean };

const ViewerContext = createContext<Viewer | null>(null);

/** Who is signed in, for client code that needs the id or the guest flag (read from the claims). */
export function ViewerProvider({ userId, isGuest, children }: Viewer & { children: ReactNode }) {
  const value = useMemo(() => ({ userId, isGuest }), [userId, isGuest]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside <ViewerProvider>.");
  return viewer;
}
