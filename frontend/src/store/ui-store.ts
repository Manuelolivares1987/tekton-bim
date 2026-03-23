import { create } from "zustand";

/** Views available in the app. Legacy views kept for backward compat but hidden from sidebar. */
export type ViewType =
  | "dashboard"
  | "ai-generator"
  | "bim-modeler"
  | "viewer"
  | "sip-panelization"
  | "panelization-takeoff"
  | "panel-viewer-3d"
  | "shop-drawings"
  | "electrical"
  | "plumbing"
  // Legacy — not in sidebar but still routable
  | "takeoff"
  | "wall-calc"
  | "volcanic-rock"
  | "panels"
  | "materials"
  | "ai-chat"
  | "panel-assignment"
  | "assembly-plans"
  | "lumber-takeoff"
  | "board-coverage"
  | "floor-plan";

interface UIStore {
  activeView: ViewType;
  sidebarOpen: boolean;
  setActiveView: (view: ViewType) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeView: "dashboard",
  sidebarOpen: true,
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
