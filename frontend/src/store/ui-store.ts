import { create } from "zustand";

export type ViewType =
  | "dashboard"
  | "viewer"
  | "takeoff"
  | "wall-calc"
  | "volcanic-rock"
  | "panels"
  | "materials"
  | "electrical"
  | "plumbing"
  | "ai-chat"
  | "ai-generator"
  | "panel-assignment"
  | "assembly-plans"
  | "lumber-takeoff"
  | "board-coverage"
  | "sip-panelization"
  | "panelization-takeoff"
  | "panel-viewer-3d"
  | "shop-drawings"
  | "floor-plan"
  | "bim-modeler";

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
