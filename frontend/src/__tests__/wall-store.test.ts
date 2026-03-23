/**
 * Tests for wall-store.ts — domain state management.
 * Mocks the API layer to test store logic in isolation.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWallStore } from "../store/wall-store";

// Mock the API module
vi.mock("../api/bim-modeler-api", () => ({
  listWalls: vi.fn(),
  drawWall: vi.fn(),
  deleteWall: vi.fn(),
  addWallOpening: vi.fn(),
  removeWallOpening: vi.fn(),
  getWallAssembly: vi.fn(),
  listPanels: vi.fn(),
  listStoreys: vi.fn(),
  listCatalog: vi.fn(),
  getSummary: vi.fn(),
}));

import * as api from "../api/bim-modeler-api";

const mockWall = (id: number, label: string = `W-${id}`) => ({
  id,
  project_id: 1,
  storey_id: null,
  label,
  start_x_mm: 0,
  start_z_mm: 0,
  end_x_mm: 3660,
  end_z_mm: 0,
  height_mm: 2440,
  thickness_mm: 136,
  length_mm: 3660,
  rotation_deg: 0,
  panel_count: 3,
  standard_panel_width_mm: 1220,
  stud_spacing_mm: 400,
  openings: [],
});

const mockPanel = (id: number, wallId: number) => ({
  id,
  project_id: 1,
  panel_catalog_id: null,
  wall_id: wallId,
  wall_group_id: null,
  storey_id: null,
  label: `P-${id}`,
  storey_name: "Piso 1",
  orientation: "wall" as const,
  pos_x_mm: 0,
  pos_y_mm: 0,
  pos_z_mm: 0,
  rotation_deg: 0,
  pitch_deg: 0,
  width_mm: 1220,
  height_mm: 2440,
  thickness_mm: 136,
  has_opening: false,
  opening_type: null,
  opening_x_mm: null,
  opening_y_mm: null,
  opening_width_mm: null,
  opening_height_mm: null,
  ifc_element_id: null,
  created_at: "2026-01-01",
});

const mockAssembly = (wallId: number) => ({
  wall: mockWall(wallId),
  panels: [mockPanel(100 + wallId, wallId), mockPanel(200 + wallId, wallId)],
  framing: [],
  openings: [],
});

beforeEach(() => {
  // Reset store state
  useWallStore.setState({
    walls: [],
    panels: [],
    wallAssemblies: {},
    storeys: [],
    activeStoreyId: null,
    catalog: [],
    summary: null,
  });
  vi.clearAllMocks();
});

describe("WallStore", () => {
  describe("initial state", () => {
    it("starts with empty collections", () => {
      const s = useWallStore.getState();
      expect(s.walls).toEqual([]);
      expect(s.panels).toEqual([]);
      expect(s.wallAssemblies).toEqual({});
    });
  });

  describe("fetchWalls", () => {
    it("fetches and sets walls", async () => {
      const walls = [mockWall(1), mockWall(2)];
      vi.mocked(api.listWalls).mockResolvedValue(walls);

      await useWallStore.getState().fetchWalls(1);
      expect(api.listWalls).toHaveBeenCalledWith(1);
      expect(useWallStore.getState().walls).toHaveLength(2);
    });

    it("replaces previous walls on refetch", async () => {
      useWallStore.setState({ walls: [mockWall(99)] });
      vi.mocked(api.listWalls).mockResolvedValue([mockWall(1)]);

      await useWallStore.getState().fetchWalls(1);
      expect(useWallStore.getState().walls).toHaveLength(1);
      expect(useWallStore.getState().walls[0].id).toBe(1);
    });
  });

  describe("drawWall", () => {
    it("adds wall, assembly, and panels to store", async () => {
      const assembly = mockAssembly(1);
      vi.mocked(api.drawWall).mockResolvedValue(assembly);

      const result = await useWallStore.getState().drawWall({
        project_id: 1,
        start_x_mm: 0, start_z_mm: 0,
        end_x_mm: 3660, end_z_mm: 0,
      });

      expect(result.wall.id).toBe(1);
      expect(useWallStore.getState().walls).toHaveLength(1);
      expect(useWallStore.getState().panels).toHaveLength(2);
      expect(useWallStore.getState().wallAssemblies[1]).toBeDefined();
    });

    it("appends to existing walls", async () => {
      useWallStore.setState({ walls: [mockWall(1)], panels: [mockPanel(10, 1)] });
      const assembly = mockAssembly(2);
      vi.mocked(api.drawWall).mockResolvedValue(assembly);

      await useWallStore.getState().drawWall({
        project_id: 1,
        start_x_mm: 0, start_z_mm: 2000,
        end_x_mm: 3660, end_z_mm: 2000,
      });

      expect(useWallStore.getState().walls).toHaveLength(2);
      expect(useWallStore.getState().panels).toHaveLength(3); // 1 existing + 2 new
    });
  });

  describe("deleteWall", () => {
    it("removes wall, assembly, and associated panels", async () => {
      useWallStore.setState({
        walls: [mockWall(1), mockWall(2)],
        panels: [mockPanel(10, 1), mockPanel(20, 2)],
        wallAssemblies: { 1: mockAssembly(1), 2: mockAssembly(2) },
      });
      vi.mocked(api.deleteWall).mockResolvedValue(undefined);

      await useWallStore.getState().deleteWall(1);

      expect(useWallStore.getState().walls).toHaveLength(1);
      expect(useWallStore.getState().walls[0].id).toBe(2);
      expect(useWallStore.getState().panels).toHaveLength(1);
      expect(useWallStore.getState().panels[0].wall_id).toBe(2);
      expect(useWallStore.getState().wallAssemblies[1]).toBeUndefined();
      expect(useWallStore.getState().wallAssemblies[2]).toBeDefined();
    });
  });

  describe("addWallOpening", () => {
    it("updates assembly and replaces panels for that wall", async () => {
      useWallStore.setState({
        walls: [mockWall(1)],
        panels: [mockPanel(10, 1), mockPanel(11, 1)],
        wallAssemblies: { 1: mockAssembly(1) },
      });

      const updatedAssembly = {
        ...mockAssembly(1),
        panels: [mockPanel(30, 1), mockPanel(31, 1), mockPanel(32, 1)], // 3 panels after opening
        openings: [{ id: 1, wall_id: 1, opening_type: "window", label: "V-01", position_along_mm: 1500, position_y_mm: 900, width_mm: 1200, height_mm: 1200 }],
      };
      vi.mocked(api.addWallOpening).mockResolvedValue(updatedAssembly);

      await useWallStore.getState().addWallOpening(1, {
        opening_type: "window",
        position_along_mm: 1500,
        width_mm: 1200,
        height_mm: 1200,
      });

      expect(useWallStore.getState().panels).toHaveLength(3); // replaced
      expect(useWallStore.getState().wallAssemblies[1].openings).toHaveLength(1);
    });
  });

  describe("fetchStoreys", () => {
    it("sets active storey to first on initial load", async () => {
      vi.mocked(api.listStoreys).mockResolvedValue([
        { id: 10, project_id: 1, name: "Piso 1", level_index: 0, elevation_mm: 0, floor_height_mm: 2440 },
      ]);

      await useWallStore.getState().fetchStoreys(1);
      expect(useWallStore.getState().activeStoreyId).toBe(10);
    });

    it("does not override existing active storey", async () => {
      useWallStore.setState({ activeStoreyId: 5 });
      vi.mocked(api.listStoreys).mockResolvedValue([
        { id: 10, project_id: 1, name: "Piso 1", level_index: 0, elevation_mm: 0, floor_height_mm: 2440 },
      ]);

      await useWallStore.getState().fetchStoreys(1);
      expect(useWallStore.getState().activeStoreyId).toBe(5); // kept
    });
  });
});
