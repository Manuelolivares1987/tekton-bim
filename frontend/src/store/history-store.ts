/**
 * History Store — Undo/Redo with Command Pattern.
 *
 * Every undoable action pushes a Command with execute() and undo().
 * Ctrl+Z pops from undoStack → calls undo() → pushes to redoStack.
 * Ctrl+Shift+Z pops from redoStack → calls execute() → pushes to undoStack.
 */
import { create } from "zustand";

export interface Command {
  type: string;
  description: string;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
}

interface HistoryStore {
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string;

  /** Execute a command and push to undo stack */
  execute: (command: Command) => Promise<void>;

  /** Undo last command */
  undo: () => Promise<void>;

  /** Redo last undone command */
  redo: () => Promise<void>;

  /** Clear all history (e.g., on project switch) */
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  lastAction: "",

  execute: async (command) => {
    await command.execute();
    set((s) => ({
      undoStack: [...s.undoStack, command],
      redoStack: [], // clear redo on new action
      canUndo: true,
      canRedo: false,
      lastAction: command.description,
    }));
  },

  undo: async () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const command = undoStack[undoStack.length - 1];
    await command.undo();
    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, command],
      canUndo: s.undoStack.length > 1,
      canRedo: true,
      lastAction: `Deshacer: ${command.description}`,
    }));
  },

  redo: async () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const command = redoStack[redoStack.length - 1];
    await command.execute();
    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, command],
      canRedo: s.redoStack.length > 1,
      canUndo: true,
      lastAction: command.description,
    }));
  },

  clear: () => set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false, lastAction: "" }),
}));
