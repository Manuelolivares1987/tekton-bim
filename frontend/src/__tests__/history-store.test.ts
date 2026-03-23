/**
 * Tests for history-store.ts — undo/redo command pattern.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "../store/history-store";

// Reset store between tests
beforeEach(() => {
  useHistoryStore.getState().clear();
});

describe("HistoryStore", () => {
  it("starts empty", () => {
    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
  });

  it("execute pushes to undoStack", async () => {
    let executed = false;
    await useHistoryStore.getState().execute({
      type: "test",
      description: "test action",
      execute: async () => { executed = true; },
      undo: async () => {},
    });
    expect(executed).toBe(true);
    expect(useHistoryStore.getState().canUndo).toBe(true);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    expect(useHistoryStore.getState().lastAction).toBe("test action");
  });

  it("undo calls command.undo and moves to redoStack", async () => {
    let value = 0;
    await useHistoryStore.getState().execute({
      type: "test",
      description: "increment",
      execute: async () => { value = 1; },
      undo: async () => { value = 0; },
    });
    expect(value).toBe(1);

    await useHistoryStore.getState().undo();
    expect(value).toBe(0);
    expect(useHistoryStore.getState().canUndo).toBe(false);
    expect(useHistoryStore.getState().canRedo).toBe(true);
    expect(useHistoryStore.getState().redoStack).toHaveLength(1);
  });

  it("redo re-executes and moves back to undoStack", async () => {
    let value = 0;
    await useHistoryStore.getState().execute({
      type: "test",
      description: "set to 1",
      execute: async () => { value = 1; },
      undo: async () => { value = 0; },
    });
    await useHistoryStore.getState().undo();
    expect(value).toBe(0);

    await useHistoryStore.getState().redo();
    expect(value).toBe(1);
    expect(useHistoryStore.getState().canUndo).toBe(true);
    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  it("new execute clears redoStack", async () => {
    await useHistoryStore.getState().execute({
      type: "a", description: "first",
      execute: async () => {}, undo: async () => {},
    });
    await useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().canRedo).toBe(true);

    // New action should clear redo
    await useHistoryStore.getState().execute({
      type: "b", description: "second",
      execute: async () => {}, undo: async () => {},
    });
    expect(useHistoryStore.getState().canRedo).toBe(false);
    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("multiple undo/redo maintains correct order", async () => {
    const log: string[] = [];
    for (const name of ["A", "B", "C"]) {
      await useHistoryStore.getState().execute({
        type: "test", description: name,
        execute: async () => { log.push(`do:${name}`); },
        undo: async () => { log.push(`undo:${name}`); },
      });
    }
    expect(log).toEqual(["do:A", "do:B", "do:C"]);
    expect(useHistoryStore.getState().undoStack).toHaveLength(3);

    await useHistoryStore.getState().undo(); // undo C
    await useHistoryStore.getState().undo(); // undo B
    expect(log).toEqual(["do:A", "do:B", "do:C", "undo:C", "undo:B"]);

    await useHistoryStore.getState().redo(); // redo B
    expect(log).toEqual(["do:A", "do:B", "do:C", "undo:C", "undo:B", "do:B"]);
  });

  it("undo on empty stack does nothing", async () => {
    await useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
  });

  it("redo on empty stack does nothing", async () => {
    await useHistoryStore.getState().redo();
    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("clear resets everything", async () => {
    await useHistoryStore.getState().execute({
      type: "test", description: "x",
      execute: async () => {}, undo: async () => {},
    });
    useHistoryStore.getState().clear();
    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoStack).toHaveLength(0);
    expect(state.lastAction).toBe("");
  });
});
