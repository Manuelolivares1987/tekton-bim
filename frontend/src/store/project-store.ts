import { create } from "zustand";
import type { Project } from "../types/api";
import { listProjects, createProject, deleteProject } from "../api/projects-api";

interface ProjectStore {
  projects: Project[];
  currentProjectId: number | null;
  loading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  addProject: (name: string, description?: string, location?: string) => Promise<Project>;
  removeProject: (id: number) => Promise<void>;
  setCurrentProject: (id: number | null) => void;
  getCurrentProject: () => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await listProjects();
      set({ projects, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  addProject: async (name, description, location) => {
    const project = await createProject({ name, description, location });
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  removeProject: async (id) => {
    await deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId:
        state.currentProjectId === id ? null : state.currentProjectId,
    }));
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId);
  },
}));
