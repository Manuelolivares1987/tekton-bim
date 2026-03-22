import { create } from "zustand";
import type { SipPanelConfig, PanelizationResult, WallOpening } from "../types/api";
import * as api from "../api/panelization-api";

interface PanelizationStore {
  // SIP configs
  sipConfigs: SipPanelConfig[];
  currentConfigId: number | null;
  loadingSipConfigs: boolean;

  // Panelization results
  results: PanelizationResult[];
  currentResult: PanelizationResult | null;
  loadingResults: boolean;

  // Wall openings
  openings: WallOpening[];

  // Selected wall
  selectedWallId: number | null;

  // Actions
  fetchSipConfigs: (projectId: number) => Promise<void>;
  setCurrentConfig: (configId: number | null) => void;
  fetchResults: (projectId: number) => Promise<void>;
  setCurrentResult: (result: PanelizationResult | null) => void;
  setSelectedWall: (wallId: number | null) => void;
  fetchOpenings: (elementId: number) => Promise<void>;
  clearOpenings: () => void;
}

export const usePanelizationStore = create<PanelizationStore>((set) => ({
  sipConfigs: [],
  currentConfigId: null,
  loadingSipConfigs: false,
  results: [],
  currentResult: null,
  loadingResults: false,
  openings: [],
  selectedWallId: null,

  fetchSipConfigs: async (projectId: number) => {
    set({ loadingSipConfigs: true });
    try {
      const configs = await api.listSipConfigs(projectId);
      set({ sipConfigs: configs, loadingSipConfigs: false });
    } catch {
      set({ loadingSipConfigs: false });
    }
  },

  setCurrentConfig: (configId) => set({ currentConfigId: configId }),

  fetchResults: async (projectId: number) => {
    set({ loadingResults: true });
    try {
      const results = await api.listPanelizationResults(projectId);
      set({ results, loadingResults: false });
    } catch {
      set({ loadingResults: false });
    }
  },

  setCurrentResult: (result) => set({ currentResult: result }),

  setSelectedWall: (wallId) => set({ selectedWallId: wallId }),

  fetchOpenings: async (elementId: number) => {
    try {
      const openings = await api.getWallOpenings(elementId);
      set({ openings });
    } catch {
      set({ openings: [] });
    }
  },

  clearOpenings: () => set({ openings: [] }),
}));
