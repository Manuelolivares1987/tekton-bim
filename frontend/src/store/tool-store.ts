/**
 * Tool & Interaction Store — active tool, drawing state, selection.
 * Purely UI/interaction concerns, no domain data.
 */
import { create } from "zustand";

export type BimTool = "draw-wall" | "wall-opening" | "orbit" | "delete";

interface ToolStore {
  // Active tool
  activeTool: BimTool;
  setTool: (tool: BimTool) => void;

  // Selection
  selectedWallId: number | null;
  selectedPanelId: number | null;
  selectWall: (id: number | null) => void;
  selectPanel: (id: number | null) => void;
  clearSelection: () => void;

  // Drawing transient state (wall P1 while waiting for P2)
  drawingWallStart: { x: number; z: number } | null;
  startDrawingWall: (x: number, z: number) => void;
  cancelDrawingWall: () => void;

  // UI toggles
  showFraming: boolean;
  toggleFraming: () => void;
}

export const useToolStore = create<ToolStore>((set) => ({
  activeTool: "draw-wall",
  setTool: (tool) => set({ activeTool: tool }),

  selectedWallId: null,
  selectedPanelId: null,
  selectWall: (id) => set({ selectedWallId: id }),
  selectPanel: (id) => set({ selectedPanelId: id }),
  clearSelection: () => set({ selectedWallId: null, selectedPanelId: null }),

  drawingWallStart: null,
  startDrawingWall: (x, z) => set({ drawingWallStart: { x, z } }),
  cancelDrawingWall: () => set({ drawingWallStart: null }),

  showFraming: true, // on by default for SIP
  toggleFraming: () => set((s) => ({ showFraming: !s.showFraming })),
}));
