/**
 * WallRenderer — renders wall panels and framing into a Three.js scene.
 * No React dependency. Pure imperative rendering.
 */
import * as THREE from "three";
import { SCALE, backendRotToThreeY } from "./geometry";
import type { BimPanelData, FramingMemberData, WallAssemblyData } from "../../api/bim-modeler-api";

// ── Colors ──
const PANEL_COLOR = 0x8b7355;
const PANEL_SELECTED_COLOR = 0x3b82f6;
const PANEL_EDGE_COLOR = 0x5a5040;
const OPENING_COLOR = 0x1a1a2e;

const FRAMING_COLORS: Record<string, number> = {
  stud: 0xdeb887,
  king_stud: 0xcd853f,
  jack_stud: 0xd2691e,
  cripple_stud: 0xbc8f8f,
  top_plate: 0xa0522d,
  bottom_plate: 0xa0522d,
  header: 0x8b0000,
  sill_plate: 0x556b2f,
  connection_stud: 0xff6347,
  tablilla_osb: 0xf4a460,
};

// ── Panel Rendering ──

export function createPanelMesh(panel: BimPanelData, isSelected: boolean): { group: THREE.Group; mesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.userData.isBimPanel = true;
  group.userData.panelId = panel.id;
  group.userData.wallId = panel.wall_id;

  const w = panel.width_mm * SCALE;
  const h = panel.height_mm * SCALE;
  const d = panel.thickness_mm * SCALE;

  // Geometry
  const geo = new THREE.BoxGeometry(w, h, d);
  const color = isSelected ? PANEL_SELECTED_COLOR : PANEL_COLOR;
  const mat = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: isSelected ? 0.92 : 0.82,
    side: THREE.DoubleSide,
  });
  if (isSelected) mat.emissive = new THREE.Color(0x112244);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isBimPanel = true;
  // Offset so left edge of box = group origin (panel pos = left edge)
  mesh.position.x = w / 2;
  group.add(mesh);

  // Edges
  const edges = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: isSelected ? 0x5b9cf6 : PANEL_EDGE_COLOR,
    opacity: 0.25,
    transparent: true,
  });
  const edgeMesh = new THREE.LineSegments(edges, edgeMat);
  edgeMesh.position.x = w / 2;
  group.add(edgeMesh);

  // Opening cutout
  if (panel.has_opening && panel.opening_width_mm && panel.opening_height_mm) {
    const ow = panel.opening_width_mm * SCALE;
    const oh = panel.opening_height_mm * SCALE;
    const openGeo = new THREE.BoxGeometry(ow, oh, d + 0.005);
    const openMat = new THREE.MeshBasicMaterial({ color: OPENING_COLOR, transparent: true, opacity: 0.88 });
    const openMesh = new THREE.Mesh(openGeo, openMat);

    const ox = ((panel.opening_x_mm || 0) - panel.width_mm / 2 + (panel.opening_width_mm || 0) / 2) * SCALE;
    const oy = ((panel.opening_y_mm || 0) - panel.height_mm / 2 + (panel.opening_height_mm || 0) / 2) * SCALE;
    openMesh.position.set(w / 2 + ox, oy, 0);
    group.add(openMesh);

    // Opening border
    const borderColor = panel.opening_type === "door" ? 0xf59e0b : 0x06b6d4;
    const openEdges = new THREE.EdgesGeometry(openGeo);
    const openEdgeMat = new THREE.LineBasicMaterial({ color: borderColor });
    const openEdgeMesh = new THREE.LineSegments(openEdges, openEdgeMat);
    openEdgeMesh.position.copy(openMesh.position);
    group.add(openEdgeMesh);
  }

  // Position group in world space
  const threeRotY = backendRotToThreeY(panel.rotation_deg);
  group.position.set(
    panel.pos_x_mm * SCALE,
    panel.pos_y_mm * SCALE + h / 2,
    panel.pos_z_mm * SCALE,
  );
  group.rotation.y = threeRotY;

  return { group, mesh };
}

/** Rebuild all panel meshes in the scene */
export function rebuildPanels(
  scene: THREE.Scene,
  panels: BimPanelData[],
  selectedPanelId: number | null,
  meshMap: Map<THREE.Mesh, BimPanelData>,
): void {
  // Remove old panel objects
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((obj) => { if (obj.userData.isBimPanel) toRemove.push(obj); });
  toRemove.forEach((obj) => scene.remove(obj));
  meshMap.clear();

  for (const panel of panels) {
    const { group, mesh } = createPanelMesh(panel, panel.id === selectedPanelId);
    scene.add(group);
    meshMap.set(mesh, panel);
  }
}

// ── Framing Rendering ──

export function rebuildFraming(
  scene: THREE.Scene,
  framingMeshes: THREE.Object3D[],
  wallAssemblies: Record<number, WallAssemblyData>,
): THREE.Object3D[] {
  // Remove old
  framingMeshes.forEach((obj) => scene.remove(obj));
  const newMeshes: THREE.Object3D[] = [];

  // Collect all framing from all assemblies
  for (const assembly of Object.values(wallAssemblies)) {
    if (!assembly.framing || assembly.framing.length === 0) continue;

    for (const member of assembly.framing) {
      const mesh = createFramingMesh(member);
      if (mesh) {
        scene.add(mesh);
        newMeshes.push(mesh);
      }
    }
  }

  return newMeshes;
}

function createFramingMesh(member: FramingMemberData): THREE.Mesh | null {
  const rotDeg = member.panel_rotation_deg ?? 0;
  const rotY = backendRotToThreeY(rotDeg);
  // Use the ORIGINAL angle (not negated) for position transform
  // because the backend rotation_deg = atan2(dz, dx):
  //   0° → along +X, 90° → along +Z
  const posRad = (rotDeg * Math.PI) / 180;

  const wallStartX = (member.world_x_mm ?? 0) * SCALE;
  const wallStartY = (member.world_y_mm ?? 0) * SCALE;
  const wallStartZ = (member.world_z_mm ?? 0) * SCALE;

  const isHorizontal = member.member_type.includes("plate") || member.member_type === "header";

  let geoW: number, geoH: number, geoD: number;
  if (isHorizontal) {
    geoW = member.length_mm * SCALE;
    geoH = member.width_mm * SCALE;
    geoD = member.depth_mm * SCALE;
  } else {
    geoW = member.width_mm * SCALE;
    geoH = member.length_mm * SCALE;
    geoD = member.depth_mm * SCALE;
  }

  if (geoW < 0.001 || geoH < 0.001) return null;

  const geo = new THREE.BoxGeometry(geoW, geoH, geoD);
  const color = FRAMING_COLORS[member.member_type] || FRAMING_COLORS.stud;
  const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.82 });
  const mesh = new THREE.Mesh(geo, mat);

  // Compute center offset along wall axis
  let localAlongMm: number, localUpMm: number;
  if (isHorizontal) {
    localAlongMm = member.position_x_mm + member.length_mm / 2;
    localUpMm = member.position_y_mm + member.width_mm / 2;
  } else {
    localAlongMm = member.position_x_mm + member.width_mm / 2;
    localUpMm = member.position_y_mm + member.length_mm / 2;
  }

  // Transform local offset to world XZ using wall direction (original angle)
  const localM = localAlongMm * SCALE;
  mesh.position.set(
    wallStartX + Math.cos(posRad) * localM,
    wallStartY + localUpMm * SCALE,
    wallStartZ + Math.sin(posRad) * localM,
  );
  // Visual rotation (negated for Three.js convention)
  mesh.rotation.y = rotY;

  // Thin edges
  const edges = new THREE.EdgesGeometry(geo);
  mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.15, transparent: true })));

  return mesh;
}

// ── Ghost Wall (during drawing) ──

export function createGhostWall(
  startXm: number, startZm: number,
  endXm: number, endZm: number,
  heightM: number = 2.44,
  thicknessM: number = 0.136,
): THREE.Group {
  const dx = endXm - startXm;
  const dz = endZm - startZm;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Group();

  const rotation = Math.atan2(dz, dx);
  const group = new THREE.Group();

  const geo = new THREE.BoxGeometry(length, heightM, thicknessM);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xe5a44c,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.x = length / 2;
  group.add(mesh);

  const edges = new THREE.EdgesGeometry(geo);
  const edgeMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color: 0xe5a44c, opacity: 0.7, transparent: true,
  }));
  edgeMesh.position.x = length / 2;
  group.add(edgeMesh);

  // Position at start, rotate toward end
  group.position.set(startXm, heightM / 2, startZm);
  group.rotation.y = -rotation; // negate for Three.js convention

  return group;
}

// ── Roof Rendering ──

const ROOF_COLOR = 0xb87333; // copper
const RIDGE_COLOR = 0xe5a44c;

export function rebuildRoofs(
  scene: THREE.Scene,
  roofMeshes: THREE.Object3D[],
  roofGeometries: Array<{ planes: Array<{ vertices: number[][] }>; ridge_line?: number[][] | null }>,
): THREE.Object3D[] {
  roofMeshes.forEach((obj) => scene.remove(obj));
  const newMeshes: THREE.Object3D[] = [];

  for (const roofGeo of roofGeometries) {
    // Render each roof plane
    for (const plane of roofGeo.planes) {
      if (plane.vertices.length < 3) continue;

      const geo = new THREE.BufferGeometry();
      const vertices: number[] = [];
      const indices: number[] = [];

      for (const v of plane.vertices) {
        vertices.push(v[0] * SCALE, v[1] * SCALE, v[2] * SCALE);
      }

      // Triangulate (fan from first vertex)
      for (let i = 1; i < plane.vertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mat = new THREE.MeshPhongMaterial({
        color: ROOF_COLOR,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      scene.add(mesh);
      newMeshes.push(mesh);

      // Edges
      const edges = new THREE.EdgesGeometry(geo);
      const edgeMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x8b5e3c, opacity: 0.6, transparent: true,
      }));
      scene.add(edgeMesh);
      newMeshes.push(edgeMesh);
    }

    // Ridge line
    if (roofGeo.ridge_line && roofGeo.ridge_line.length === 2) {
      const r = roofGeo.ridge_line;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(r[0][0] * SCALE, r[0][1] * SCALE, r[0][2] * SCALE),
        new THREE.Vector3(r[1][0] * SCALE, r[1][1] * SCALE, r[1][2] * SCALE),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: RIDGE_COLOR, linewidth: 2 });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      newMeshes.push(line);
    }
  }

  return newMeshes;
}

/** Start point marker */
export function createStartMarker(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.07, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe5a44c, depthTest: false });
  const marker = new THREE.Mesh(geo, mat);
  marker.renderOrder = 1000;
  marker.visible = false;
  return marker;
}
