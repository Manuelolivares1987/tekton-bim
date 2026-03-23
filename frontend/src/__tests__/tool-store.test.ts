/**
 * Tests for tool-store.ts — UI interaction state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "../store/tool-store";

beforeEach(() => {
  useToolStore.setState({
    activeTool: "draw-wall",
    selectedWallId: null,
    selectedPanelId: null,
    drawingWallStart: null,
    showFraming: true,
  });
});

describe("ToolStore", () => {
  it("defaults to draw-wall tool", () => {
    expect(useToolStore.getState().activeTool).toBe("draw-wall");
  });

  it("switches tool", () => {
    useToolStore.getState().setTool("delete");
    expect(useToolStore.getState().activeTool).toBe("delete");
  });

  it("selects and clears wall", () => {
    useToolStore.getState().selectWall(42);
    expect(useToolStore.getState().selectedWallId).toBe(42);
    useToolStore.getState().clearSelection();
    expect(useToolStore.getState().selectedWallId).toBeNull();
    expect(useToolStore.getState().selectedPanelId).toBeNull();
  });

  it("starts and cancels wall drawing", () => {
    useToolStore.getState().startDrawingWall(1000, 2000);
    expect(useToolStore.getState().drawingWallStart).toEqual({ x: 1000, z: 2000 });
    useToolStore.getState().cancelDrawingWall();
    expect(useToolStore.getState().drawingWallStart).toBeNull();
  });

  it("toggles framing visibility", () => {
    expect(useToolStore.getState().showFraming).toBe(true);
    useToolStore.getState().toggleFraming();
    expect(useToolStore.getState().showFraming).toBe(false);
    useToolStore.getState().toggleFraming();
    expect(useToolStore.getState().showFraming).toBe(true);
  });
});
