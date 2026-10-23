"use client";

import type { ReactNode } from "react";
import { BoardDndProvider } from "@/components/dnd/board-dnd-provider";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useT } from "@/i18n/client";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useRehydrateUiStore, useUiStore } from "@/stores/ui-store";

type AppShellProps = {
  /** Signed-in email, or null for a guest. */
  email: string | null;
  children: ReactNode;
};

/**
 * Sidebar + scrolling main column. Desktop (md and up): a 260px sidebar that can be collapsed.
 * Mobile: the same sidebar inside a drawer opened from the toolbar's menu button.
 */
export function AppShell({ email, children }: AppShellProps) {
  const t = useT().shell;
  useRehydrateUiStore();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const mobileOpen = useUiStore((state) => state.mobileSidebarOpen);
  const setMobileOpen = useUiStore((state) => state.setMobileSidebarOpen);

  return (
    <BoardDndProvider>
      <div className="flex min-h-0 flex-1">
        <div
          data-slot="sidebar"
          className={cn(
            "border-line bg-surface w-[260px] shrink-0 border-r backdrop-blur-md",
            collapsed ? "hidden" : "hidden md:block",
          )}
        >
          <Sidebar email={email} />
        </div>

        <Drawer direction="left" open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent aria-describedby={undefined} className="bg-paper md:hidden">
            <DrawerTitle className="sr-only">{t.sidebar.drawerTitle}</DrawerTitle>
            <Sidebar email={email} onNavigate={() => setMobileOpen(false)} />
          </DrawerContent>
        </Drawer>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </BoardDndProvider>
  );
}
