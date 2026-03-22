import { create } from "zustand";
import type { IfcModel, IfcModelSummary } from "../types/api";
import { listModels, getModelSummary, uploadIfc } from "../api/ifc-api";

interface IfcStore {
  models: IfcModel[];
  currentModelId: number | null;
  currentSummary: IfcModelSummary | null;
  selectedElementIds: string[];
  loading: boolean;
  uploading: boolean;
  error: string | null;

  fetchModels: (projectId?: number) => Promise<void>;
  uploadModel: (projectId: number, file: File) => Promise<void>;
  selectModel: (modelId: number) => Promise<void>;
  setSelectedElements: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useIfcStore = create<IfcStore>((set) => ({
  models: [],
  currentModelId: null,
  currentSummary: null,
  selectedElementIds: [],
  loading: false,
  uploading: false,
  error: null,

  fetchModels: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const models = await listModels(projectId);
      // Auto-select the latest model if none is selected
      const currentId = useIfcStore.getState().currentModelId;
      if (!currentId && models.length > 0) {
        const latestModel = models[0]; // sorted by created_at desc
        set({ models, loading: false, currentModelId: latestModel.id });
        // Also load summary
        try {
          const summary = await getModelSummary(latestModel.id);
          set({ currentSummary: summary });
        } catch {}
      } else {
        set({ models, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  uploadModel: async (projectId, file) => {
    set({ uploading: true, error: null });
    try {
      const result = await uploadIfc(projectId, file);
      const models = await listModels(projectId);
      set({ models, uploading: false, currentModelId: result.model_id });
      // Load summary
      const summary = await getModelSummary(result.model_id);
      set({ currentSummary: summary });
    } catch (err: any) {
      set({ error: err.message, uploading: false });
    }
  },

  selectModel: async (modelId) => {
    set({ currentModelId: modelId, loading: true });
    try {
      const summary = await getModelSummary(modelId);
      set({ currentSummary: summary, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setSelectedElements: (ids) => set({ selectedElementIds: ids }),

  clearSelection: () =>
    set({ currentModelId: null, currentSummary: null, selectedElementIds: [] }),
}));
