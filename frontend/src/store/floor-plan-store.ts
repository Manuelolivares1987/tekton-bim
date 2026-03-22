import { create } from "zustand";
import type { FloorPlan, FloorPlanWall, FloorPlanStorey } from "../types/api";
import * as api from "../api/floor-plan-api";

export type FloorPlanTool = "select" | "draw-wall" | "door" | "window" | "eraser" | "pan";

interface FloorPlanStore {
  // Data
  plans: FloorPlan[];
  currentPlan: FloorPlan | null;
  currentStoreyId: number | null;

  // Editor state
  activeTool: FloorPlanTool;
  gridSize: number;
  snapEnabled: boolean;
  wallThickness: number;
  selectedWallId: number | null;
  selectedOpeningId: number | null;
  drawingStart: { x: number; y: number } | null;
  zoom: number;
  panOffset: { x: number; y: number };
  viewMode: "2d" | "3d";

  // Actions
  fetchPlans: (projectId: number) => Promise<void>;
  createPlan: (projectId: number, name: string) => Promise<FloorPlan>;
  loadPlan: (planId: number) => Promise<void>;
  deletePlan: (planId: number) => Promise<void>;
  setCurrentStorey: (storeyId: number) => void;

  addWallToStorey: (wall: {
    start_x_mm: number;
    start_y_mm: number;
    end_x_mm: number;
    end_y_mm: number;
    thickness_mm: number;
  }) => Promise<void>;
  deleteWallFromStorey: (wallId: number) => Promise<void>;
  addOpeningToWall: (wallId: number, data: {
    opening_type: string;
    position_along_wall_mm: number;
    position_y_mm: number;
    width_mm: number;
    height_mm: number;
  }) => Promise<void>;
  deleteOpeningFromWall: (openingId: number) => Promise<void>;

  setTool: (tool: FloorPlanTool) => void;
  setGridSize: (size: number) => void;
  setWallThickness: (thickness: number) => void;
  setSelectedWall: (wallId: number | null) => void;
  setSelectedOpening: (openingId: number | null) => void;
  setDrawingStart: (point: { x: number; y: number } | null) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setViewMode: (mode: "2d" | "3d") => void;
}

export const useFloorPlanStore = create<FloorPlanStore>((set, get) => ({
  plans: [],
  currentPlan: null,
  currentStoreyId: null,
  activeTool: "draw-wall",
  gridSize: 100,
  snapEnabled: true,
  wallThickness: 150,
  selectedWallId: null,
  selectedOpeningId: null,
  drawingStart: null,
  zoom: 0.15,
  panOffset: { x: 50, y: 50 },
  viewMode: "2d",

  fetchPlans: async (projectId) => {
    const plans = await api.listFloorPlans(projectId);
    set({ plans });
  },

  createPlan: async (projectId, name) => {
    const thickness = get().wallThickness;
    const plan = await api.createFloorPlan({
      project_id: projectId,
      name,
      default_wall_thickness_mm: thickness,
    });
    set((s) => ({
      plans: [...s.plans, plan],
      currentPlan: plan,
      currentStoreyId: plan.storeys[0]?.id || null,
    }));
    return plan;
  },

  loadPlan: async (planId) => {
    const plan = await api.getFloorPlan(planId);
    set({
      currentPlan: plan,
      currentStoreyId: plan.storeys[0]?.id || null,
      selectedWallId: null,
      selectedOpeningId: null,
    });
  },

  deletePlan: async (planId) => {
    await api.deleteFloorPlan(planId);
    set((s) => ({
      plans: s.plans.filter((p) => p.id !== planId),
      currentPlan: s.currentPlan?.id === planId ? null : s.currentPlan,
    }));
  },

  setCurrentStorey: (storeyId) => set({ currentStoreyId: storeyId, selectedWallId: null }),

  addWallToStorey: async (wallData) => {
    const { currentPlan, currentStoreyId } = get();
    if (!currentPlan || !currentStoreyId) return;

    const wall = await api.addWall(currentPlan.id, currentStoreyId, wallData);
    // Reload plan to get updated data
    const plan = await api.getFloorPlan(currentPlan.id);
    set({ currentPlan: plan });
  },

  deleteWallFromStorey: async (wallId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    await api.deleteWall(currentPlan.id, wallId);
    const plan = await api.getFloorPlan(currentPlan.id);
    set({ currentPlan: plan, selectedWallId: null });
  },

  addOpeningToWall: async (wallId, data) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    await api.addOpening(currentPlan.id, wallId, data);
    const plan = await api.getFloorPlan(currentPlan.id);
    set({ currentPlan: plan });
  },

  deleteOpeningFromWall: async (openingId) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    await api.deleteOpening(currentPlan.id, openingId);
    const plan = await api.getFloorPlan(currentPlan.id);
    set({ currentPlan: plan });
  },

  setTool: (tool) => set({ activeTool: tool, drawingStart: null }),
  setGridSize: (gridSize) => set({ gridSize }),
  setWallThickness: (wallThickness) => set({ wallThickness }),
  setSelectedWall: (selectedWallId) => set({ selectedWallId, selectedOpeningId: null }),
  setSelectedOpening: (selectedOpeningId) => set({ selectedOpeningId }),
  setDrawingStart: (drawingStart) => set({ drawingStart }),
  setZoom: (zoom) => set({ zoom: Math.max(0.02, Math.min(2, zoom)) }),
  setPanOffset: (panOffset) => set({ panOffset }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
