import { create } from "zustand";
import * as api from "../api/bim-modeler-api";
import type {
  CatalogItem,
  BimPanelData,
  BimStorey,
  WallGroupData,
  ConnectionData,
  ModularSummary,
  FramingMemberData,
  BimWallData,
  WallAssemblyData,
} from "../api/bim-modeler-api";

export type BimTool = "draw-wall" | "wall-opening" | "place" | "move" | "rotate" | "door" | "window" | "delete" | "orbit" | "place-floor" | "place-roof";
export type PanelOrientation = "wall" | "floor" | "roof";

interface BimModelerStore {
  // Data
  catalog: CatalogItem[];
  selectedCatalogId: number | null;
  panels: BimPanelData[];
  selectedPanelId: number | null;
  activeTool: BimTool;
  summary: ModularSummary | null;
  storeys: BimStorey[];
  activeStoreyId: number | null;
  wallGroups: WallGroupData[];
  connections: ConnectionData[];
  showConnections: boolean;
  showWallGroups: boolean;
  showFraming: boolean;
  framingMembers: FramingMemberData[];

  // Actions
  fetchCatalog: (projectId?: number) => Promise<void>;
  selectCatalog: (id: number | null) => void;
  fetchPanels: (projectId: number) => Promise<void>;
  placePanel: (data: Parameters<typeof api.placePanel>[0]) => Promise<BimPanelData>;
  movePanel: (panelId: number, pos: { pos_x_mm: number; pos_z_mm: number }) => Promise<void>;
  rotatePanel: (panelId: number) => Promise<void>;
  removePanel: (panelId: number) => Promise<void>;
  addOpeningToPanel: (panelId: number, type: string) => Promise<void>;
  removeOpeningFromPanel: (panelId: number) => Promise<void>;
  selectPanel: (id: number | null) => void;
  setTool: (tool: BimTool) => void;
  fetchSummary: (projectId: number) => Promise<void>;

  // Storeys
  fetchStoreys: (projectId: number) => Promise<void>;
  addStorey: (projectId: number, name: string, elevationMm: number) => Promise<void>;
  removeStorey: (storeyId: number) => Promise<void>;
  setActiveStorey: (id: number | null) => void;

  // Wall groups
  autoGroupWalls: (projectId: number) => Promise<void>;
  fetchWallGroups: (projectId: number) => Promise<void>;
  toggleConnections: () => void;
  toggleWallGroups: () => void;

  // Connections
  fetchConnections: (projectId: number) => Promise<void>;

  // Framing
  toggleFraming: () => void;
  fetchFraming: (panelId: number) => Promise<void>;
  fetchAllFraming: (projectId: number) => Promise<void>;
  clearFraming: () => void;

  // Walls
  walls: BimWallData[];
  selectedWallId: number | null;
  wallAssemblies: Record<number, WallAssemblyData>;
  drawingWallStart: { x: number; z: number } | null;
  fetchWalls: (projectId: number) => Promise<void>;
  drawWall: (data: Parameters<typeof api.drawWall>[0]) => Promise<WallAssemblyData>;
  selectWall: (id: number | null) => void;
  deleteWall: (wallId: number) => Promise<void>;
  addWallOpening: (wallId: number, data: Parameters<typeof api.addWallOpening>[1]) => Promise<WallAssemblyData>;
  removeWallOpening: (wallId: number, openingId: number) => Promise<void>;
  fetchWallAssembly: (wallId: number) => Promise<void>;
  startDrawingWall: (x: number, z: number) => void;
  cancelDrawingWall: () => void;
}

export const useBimModelerStore = create<BimModelerStore>((set, get) => ({
  catalog: [],
  selectedCatalogId: null,
  panels: [],
  selectedPanelId: null,
  activeTool: "place",
  summary: null,
  storeys: [],
  activeStoreyId: null,
  wallGroups: [],
  connections: [],
  showConnections: false,
  showWallGroups: true,
  showFraming: false,
  framingMembers: [],

  fetchCatalog: async (projectId) => {
    const catalog = await api.listCatalog(projectId);
    set({ catalog });
    if (catalog.length > 0 && !get().selectedCatalogId) {
      set({ selectedCatalogId: catalog[0].id });
    }
  },

  selectCatalog: (id) => set({ selectedCatalogId: id }),

  fetchPanels: async (projectId) => {
    const panels = await api.listPanels(projectId);
    set({ panels });
  },

  placePanel: async (data) => {
    const panel = await api.placePanel(data);
    set((s) => ({ panels: [...s.panels, panel] }));
    return panel;
  },

  movePanel: async (panelId, pos) => {
    await api.updatePanel(panelId, pos);
    set((s) => ({
      panels: s.panels.map((p) =>
        p.id === panelId ? { ...p, pos_x_mm: pos.pos_x_mm, pos_z_mm: pos.pos_z_mm } : p
      ),
    }));
  },

  rotatePanel: async (panelId) => {
    const panel = get().panels.find((p) => p.id === panelId);
    if (!panel) return;
    const newRot = (panel.rotation_deg + 90) % 360;
    await api.updatePanel(panelId, { rotation_deg: newRot });
    set((s) => ({
      panels: s.panels.map((p) =>
        p.id === panelId ? { ...p, rotation_deg: newRot } : p
      ),
    }));
  },

  removePanel: async (panelId) => {
    await api.deletePanel(panelId);
    set((s) => ({
      panels: s.panels.filter((p) => p.id !== panelId),
      selectedPanelId: s.selectedPanelId === panelId ? null : s.selectedPanelId,
    }));
  },

  addOpeningToPanel: async (panelId, type) => {
    const isDoor = type === "door";
    const result = await api.addOpening(panelId, {
      opening_type: type,
      opening_x_mm: 160,
      opening_y_mm: isDoor ? 0 : 900,
      opening_width_mm: isDoor ? 900 : 1200,
      opening_height_mm: isDoor ? 2100 : 1200,
    });
    set((s) => ({
      panels: s.panels.map((p) => (p.id === panelId ? result : p)),
    }));
  },

  removeOpeningFromPanel: async (panelId) => {
    const result = await api.removeOpening(panelId);
    set((s) => ({
      panels: s.panels.map((p) => (p.id === panelId ? result : p)),
    }));
  },

  selectPanel: (id) => set({ selectedPanelId: id }),

  setTool: (tool) => set({ activeTool: tool }),

  fetchSummary: async (projectId) => {
    const summary = await api.getSummary(projectId);
    set({ summary });
  },

  // Storeys
  fetchStoreys: async (projectId) => {
    const storeys = await api.listStoreys(projectId);
    set({ storeys });
    if (storeys.length > 0 && !get().activeStoreyId) {
      set({ activeStoreyId: storeys[0].id });
    }
  },

  addStorey: async (projectId, name, elevationMm) => {
    await api.createStorey(projectId, { name, elevation_mm: elevationMm });
    await get().fetchStoreys(projectId);
  },

  removeStorey: async (storeyId) => {
    await api.deleteStorey(storeyId);
    const { storeys, activeStoreyId } = get();
    if (activeStoreyId === storeyId) {
      set({ activeStoreyId: storeys.find((s) => s.id !== storeyId)?.id ?? null });
    }
  },

  setActiveStorey: (id) => set({ activeStoreyId: id }),

  // Wall groups
  autoGroupWalls: async (projectId) => {
    const groups = await api.autoGroupWalls(projectId);
    set({ wallGroups: groups as unknown as WallGroupData[] });
    // Refresh panels to get updated wall_group_id
    await get().fetchPanels(projectId);
  },

  fetchWallGroups: async (projectId) => {
    const groups = await api.listWallGroups(projectId);
    set({ wallGroups: groups });
  },

  toggleConnections: () => set((s) => ({ showConnections: !s.showConnections })),
  toggleWallGroups: () => set((s) => ({ showWallGroups: !s.showWallGroups })),

  // Connections
  fetchConnections: async (projectId) => {
    const connections = await api.getConnections(projectId);
    set({ connections });
  },

  // Framing
  toggleFraming: () => set((s) => ({ showFraming: !s.showFraming })),
  fetchFraming: async (panelId) => {
    const members = await api.getPanelFraming(panelId);
    set({ framingMembers: members });
  },
  fetchAllFraming: async (projectId) => {
    const members = await api.getWallFraming(projectId);
    set({ framingMembers: members });
  },
  clearFraming: () => set({ framingMembers: [] }),

  // ── Walls ──
  walls: [] as BimWallData[],
  selectedWallId: null as number | null,
  wallAssemblies: {} as Record<number, WallAssemblyData>,
  drawingWallStart: null as { x: number; z: number } | null,

  fetchWalls: async (projectId: number) => {
    const walls = await api.listWalls(projectId);
    set({ walls });
  },

  drawWall: async (data: Parameters<typeof api.drawWall>[0]) => {
    const result = await api.drawWall(data);
    set((s) => ({
      walls: [...s.walls, result.wall],
      wallAssemblies: { ...s.wallAssemblies, [result.wall.id]: result },
      panels: [...s.panels, ...result.panels],
      selectedWallId: result.wall.id,
    }));
    return result;
  },

  selectWall: (id: number | null) => set({ selectedWallId: id }),

  deleteWall: async (wallId: number) => {
    await api.deleteWall(wallId);
    set((s) => {
      const newAssemblies = { ...s.wallAssemblies };
      delete newAssemblies[wallId];
      return {
        walls: s.walls.filter((w) => w.id !== wallId),
        wallAssemblies: newAssemblies,
        panels: s.panels.filter((p) => p.wall_id !== wallId),
        selectedWallId: s.selectedWallId === wallId ? null : s.selectedWallId,
      };
    });
  },

  addWallOpening: async (wallId: number, data: Parameters<typeof api.addWallOpening>[1]) => {
    const result = await api.addWallOpening(wallId, data);
    set((s) => ({
      wallAssemblies: { ...s.wallAssemblies, [wallId]: result },
      panels: s.panels.filter((p) => p.wall_id !== wallId).concat(result.panels),
    }));
    return result;
  },

  removeWallOpening: async (wallId: number, openingId: number) => {
    const result = await api.removeWallOpening(wallId, openingId);
    set((s) => ({
      wallAssemblies: { ...s.wallAssemblies, [wallId]: result },
      panels: s.panels.filter((p) => p.wall_id !== wallId).concat(result.panels),
    }));
  },

  fetchWallAssembly: async (wallId: number) => {
    const result = await api.getWallAssembly(wallId);
    set((s) => ({
      wallAssemblies: { ...s.wallAssemblies, [wallId]: result },
    }));
  },

  startDrawingWall: (x: number, z: number) => set({ drawingWallStart: { x, z } }),
  cancelDrawingWall: () => set({ drawingWallStart: null }),
}));
