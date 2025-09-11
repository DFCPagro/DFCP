// src/store/ui.ts
import { create } from "zustand";

export interface UIState {
  /** Global side drawer (mobile/overflow) */
  isSideDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  /** Key of the currently open inline group menu (e.g., "mgr-orders") */
  openGroupKey: string | null;
  openGroup: (key: string) => void;
  closeGroup: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  isSideDrawerOpen: false,
  openDrawer: () => set({ isSideDrawerOpen: true }),
  closeDrawer: () => set({ isSideDrawerOpen: false }),
  toggleDrawer: () => set((s) => ({ isSideDrawerOpen: !s.isSideDrawerOpen })),

  openGroupKey: null,
  openGroup: (key) => set({ openGroupKey: key }),
  closeGroup: () => set({ openGroupKey: null }),
}));
