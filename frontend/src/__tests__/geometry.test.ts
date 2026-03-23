/**
 * Tests for geometry.ts — pure math, no DOM/Three.js needed.
 */
import { describe, it, expect } from "vitest";
import {
  SCALE,
  deg2rad,
  backendRotToThreeY,
  localToWorld,
  wallLength,
  snapToGrid,
  axisLock,
} from "../components/bim-modeler/geometry";

describe("deg2rad", () => {
  it("converts 0 degrees", () => {
    expect(deg2rad(0)).toBe(0);
  });
  it("converts 90 degrees", () => {
    expect(deg2rad(90)).toBeCloseTo(Math.PI / 2);
  });
  it("converts 180 degrees", () => {
    expect(deg2rad(180)).toBeCloseTo(Math.PI);
  });
  it("converts 360 degrees", () => {
    expect(deg2rad(360)).toBeCloseTo(Math.PI * 2);
  });
});

describe("backendRotToThreeY", () => {
  it("maps 0° (horizontal wall) to 0 in Three.js", () => {
    expect(backendRotToThreeY(0)).toBeCloseTo(0);
  });
  it("maps 90° (vertical wall) to -PI/2 in Three.js", () => {
    expect(backendRotToThreeY(90)).toBeCloseTo(-Math.PI / 2);
  });
  it("maps 180° to -PI", () => {
    expect(backendRotToThreeY(180)).toBeCloseTo(-Math.PI);
  });
  it("is the negation of deg2rad", () => {
    for (const deg of [0, 45, 90, 135, 180, 270]) {
      expect(backendRotToThreeY(deg)).toBeCloseTo(-deg2rad(deg));
    }
  });
});

describe("localToWorld", () => {
  it("horizontal wall: local X maps to world X", () => {
    const result = localToWorld(1000, 0, 0, 0);
    expect(result.x).toBeCloseTo(1000);
    expect(result.z).toBeCloseTo(0);
  });
  it("vertical wall (90°): local X maps to world Z", () => {
    const result = localToWorld(1000, 0, 0, 90);
    expect(result.x).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(1000);
  });
  it("with offset start point", () => {
    const result = localToWorld(500, 2000, 3000, 0);
    expect(result.x).toBeCloseTo(2500);
    expect(result.z).toBeCloseTo(3000);
  });
});

describe("wallLength", () => {
  it("horizontal wall", () => {
    expect(wallLength(0, 0, 5000, 0)).toBe(5000);
  });
  it("vertical wall", () => {
    expect(wallLength(0, 0, 0, 3000)).toBe(3000);
  });
  it("diagonal wall", () => {
    expect(wallLength(0, 0, 3000, 4000)).toBe(5000);
  });
  it("zero length", () => {
    expect(wallLength(100, 200, 100, 200)).toBe(0);
  });
});

describe("snapToGrid", () => {
  it("snaps to nearest grid point", () => {
    expect(snapToGrid(155, 100)).toBe(200);
    expect(snapToGrid(149, 100)).toBe(100);
    expect(snapToGrid(150, 100)).toBe(200); // round half up
  });
  it("exact grid values unchanged", () => {
    expect(snapToGrid(300, 100)).toBe(300);
    expect(snapToGrid(0, 100)).toBe(0);
  });
  it("negative values", () => {
    expect(snapToGrid(-155, 100)).toBe(-200);
  });
});

describe("axisLock", () => {
  it("locks to X axis when horizontal movement dominates", () => {
    const result = axisLock(0, 0, 3000, 500);
    expect(result.x).toBe(3000);
    expect(result.z).toBe(0); // locked to start Z
  });
  it("locks to Z axis when vertical movement dominates", () => {
    const result = axisLock(0, 0, 500, 3000);
    expect(result.x).toBe(0); // locked to start X
    expect(result.z).toBe(3000);
  });
  it("equal movement locks to X (X wins tie)", () => {
    const result = axisLock(0, 0, 1000, 1000);
    expect(result.x).toBe(1000);
    expect(result.z).toBe(0);
  });
  it("preserves start coordinates on locked axis", () => {
    const result = axisLock(500, 700, 3000, 750);
    expect(result.x).toBe(3000);
    expect(result.z).toBe(700); // preserved from start
  });
});

describe("SCALE constant", () => {
  it("is 0.001 (mm to meters)", () => {
    expect(SCALE).toBe(0.001);
  });
});
