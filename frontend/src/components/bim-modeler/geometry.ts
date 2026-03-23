/**
 * BIM Geometry Module — pure math, zero Three.js dependency.
 *
 * Convention:
 *   Backend: rotation_deg = atan2(dz, dx) in degrees
 *     - 0° = wall runs along +X
 *     - 90° = wall runs along +Z
 *
 *   Three.js: rotation.y positive = clockwise from above (X → -Z)
 *     - To map backend 0° (along +X) we need rotation.y = 0  ✓
 *     - To map backend 90° (along +Z) we need rotation.y = -π/2
 *     - General: threeRotY = -deg2rad(rotation_deg)
 *
 *   All positions in mm. SCALE = 0.001 converts to meters for Three.js.
 */

export const SCALE = 0.001; // mm → meters

export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert backend rotation_deg to Three.js rotation.y */
export function backendRotToThreeY(rotationDeg: number): number {
  return -deg2rad(rotationDeg);
}

/** Transform a local 2D point (along wall axis) to world XZ coordinates */
export function localToWorld(
  localAlongMm: number,
  wallStartXMm: number,
  wallStartZMm: number,
  wallRotationDeg: number,
): { x: number; z: number } {
  const rad = deg2rad(wallRotationDeg);
  return {
    x: wallStartXMm + Math.cos(rad) * localAlongMm,
    z: wallStartZMm + Math.sin(rad) * localAlongMm,
  };
}

/** Compute wall length from endpoints */
export function wallLength(
  startX: number, startZ: number,
  endX: number, endZ: number,
): number {
  const dx = endX - startX;
  const dz = endZ - startZ;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Snap a value to grid */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Axis-lock: given start and end, force to dominant axis */
export function axisLock(
  startX: number, startZ: number,
  endX: number, endZ: number,
): { x: number; z: number } {
  if (Math.abs(endX - startX) >= Math.abs(endZ - startZ)) {
    return { x: endX, z: startZ };
  }
  return { x: startX, z: endZ };
}

/**
 * Position a box mesh in 3D given its local offset along a wall.
 * Returns Three.js position {x, y, z} in meters.
 */
export function memberWorldPosition(
  positionAlongMm: number,
  positionYMm: number,
  halfWidthMm: number,
  halfHeightMm: number,
  wallStartXMm: number,
  wallStartZMm: number,
  wallRotationDeg: number,
  baseYMm: number = 0,
): { x: number; y: number; z: number } {
  const centerAlongMm = positionAlongMm + halfWidthMm;
  const world = localToWorld(centerAlongMm, wallStartXMm, wallStartZMm, wallRotationDeg);
  return {
    x: world.x * SCALE,
    y: (baseYMm + positionYMm + halfHeightMm) * SCALE,
    z: world.z * SCALE,
  };
}
