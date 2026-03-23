/**
 * Wall Domain Store — walls, panels, assemblies, openings.
 * Pure domain state, no UI/tool/transient concerns.
 */
import { create } from "zustand";
import * as api from "../api/bim-modeler-api";
import type {
  BimPanelData, BimWallData, WallAssemblyData,
  BimStorey, ModularSummary, CatalogItem,
} from "../api/bim-modeler-api";

interface WallStore {
  // Domain data
  walls: BimWallData[];
  panels: BimPanelData[];
  wallAssemblies: Record<number, WallAssemblyData>;
  storeys: BimStorey[];
  activeStoreyId: number | null;
  catalog: CatalogItem[];
  summary: ModularSummary | null;

  // Domain actions
  updateWall: (wallId: number, data: Record<string, unknown>) => Promise<WallAssemblyData>;
  fetchWalls: (projectId: number) => Promise<void>;
  drawWall: (data: Parameters<typeof api.drawWall>[0]) => Promise<WallAssemblyData>;
  deleteWall: (wallId: number) => Promise<void>;
  addWallOpening: (wallId: number, data: Parameters<typeof api.addWallOpening>[1]) => Promise<WallAssemblyData>;
  removeWallOpening: (wallId: number, openingId: number) => Promise<void>;
  fetchWallAssembly: (wallId: number) => Promise<void>;
  fetchPanels: (projectId: number) => Promise<void>;
  fetchStoreys: (projectId: number) => Promise<void>;
  setActiveStorey: (id: number | null) => void;
  fetchCatalog: (projectId?: number) => Promise<void>;
  fetchSummary: (projectId: number) => Promise<void>;
}

export const useWallStore = create<WallStore>((set, get) => ({
  walls: [],
  panels: [],
  wallAssemblies: {},
  storeys: [],
  activeStoreyId: null,
  catalog: [],
  summary: null,

  updateWall: async (wallId: number, data: Record<string, unknown>) => {
    const result = await api.updateWall(wallId, data);
    set((s) => ({
      walls: s.walls.map((w) => w.id === wallId ? result.wall : w),
      wallAssemblies: { ...s.wallAssemblies, [wallId]: result },
      panels: s.panels.filter((p) => p.wall_id !== wallId).concat(result.panels),
    }));
    return result;
  },

  fetchWalls: async (projectId) => {
    const walls = await api.listWalls(projectId);
    set({ walls });
  },

  drawWall: async (data) => {
    const result = await api.drawWall(data);
    set((s) => ({
      walls: [...s.walls, result.wall],
      wallAssemblies: { ...s.wallAssemblies, [result.wall.id]: result },
      panels: [...s.panels, ...result.panels],
    }));
    return result;
  },

  deleteWall: async (wallId) => {
    await api.deleteWall(wallId);
    set((s) => {
      const a = { ...s.wallAssemblies };
      delete a[wallId];
      return {
        walls: s.walls.filter((w) => w.id !== wallId),
        wallAssemblies: a,
        panels: s.panels.filter((p) => p.wall_id !== wallId),
      };
    });
  },

  addWallOpening: async (wallId, data) => {
    const result = await api.addWallOpening(wallId, data);
    set((s) => ({
      wallAssemblies: { ...s.wallAssemblies, [wallId]: result },
      panels: s.panels.filter((p) => p.wall_id !== wallId).concat(result.panels),
    }));
    return result;
  },

  removeWallOpening: async (wallId, openingId) => {
    const result = await api.removeWallOpening(wallId, openingId);
    set((s) => ({
      wallAssemblies: { ...s.wallAssemblies, [wallId]: result },
      panels: s.panels.filter((p) => p.wall_id !== wallId).concat(result.panels),
    }));
  },

  fetchWallAssembly: async (wallId) => {
    const result = await api.getWallAssembly(wallId);
    set((s) => ({ wallAssemblies: { ...s.wallAssemblies, [wallId]: result } }));
  },

  fetchPanels: async (projectId) => {
    const panels = await api.listPanels(projectId);
    set({ panels });
  },

  fetchStoreys: async (projectId) => {
    const storeys = await api.listStoreys(projectId);
    set({ storeys });
    if (storeys.length > 0 && !get().activeStoreyId) {
      set({ activeStoreyId: storeys[0].id });
    }
  },

  setActiveStorey: (id) => set({ activeStoreyId: id }),

  fetchCatalog: async (projectId) => {
    const catalog = await api.listCatalog(projectId);
    set({ catalog });
  },

  fetchSummary: async (projectId) => {
    const summary = await api.getSummary(projectId);
    set({ summary });
  },
}));
