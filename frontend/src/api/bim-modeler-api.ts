import client from "./client";

export interface CatalogItem {
  id: number;
  name: string;
  category: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  core_thickness_mm: number;
  skin_thickness_mm: number;
  weight_kg: number;
}

export interface BimPanelData {
  id: number;
  project_id: number;
  panel_catalog_id: number | null;
  wall_id: number | null;
  wall_group_id: number | null;
  storey_id: number | null;
  label: string;
  storey_name: string;
  orientation: "wall" | "floor" | "roof";
  pos_x_mm: number;
  pos_y_mm: number;
  pos_z_mm: number;
  rotation_deg: number;
  pitch_deg: number;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  has_opening: boolean;
  opening_type: string | null;
  opening_x_mm: number | null;
  opening_y_mm: number | null;
  opening_width_mm: number | null;
  opening_height_mm: number | null;
  ifc_element_id: number | null;
  created_at: string;
}

export interface BimStorey {
  id: number;
  project_id: number;
  name: string;
  level_index: number;
  elevation_mm: number;
  floor_height_mm: number;
}

export interface WallGroupData {
  id: number;
  name: string;
  storey_id: number | null;
  axis_angle_deg: number;
  total_length_mm: number;
  panel_count: number;
  panels: string[];
}

export interface ConnectionData {
  panel_a_id: number;
  panel_a_label: string;
  panel_b_id: number;
  panel_b_label: string;
  type: "inline" | "corner" | "angled";
  pos_x_mm: number;
  pos_y_mm: number;
  pos_z_mm: number;
}

export interface ModularSummary {
  total_panels: number;
  wall_panels: number;
  floor_panels: number;
  roof_panels: number;
  wall_area_m2: number;
  floor_area_m2: number;
  roof_area_m2: number;
  total_weight_kg: number;
  wall_groups: number;
  connections: number;
  storeys: { id: number; name: string; elevation_mm: number }[];
  by_storey: Record<string, number>;
}

// ── Catalog ──

export async function listCatalog(projectId?: number): Promise<CatalogItem[]> {
  const res = await client.get("/bim-modeler/catalogs", { params: { project_id: projectId } });
  return res.data;
}

export async function createCatalog(data: Partial<CatalogItem> & { project_id?: number }): Promise<CatalogItem> {
  const res = await client.post("/bim-modeler/catalogs", data);
  return res.data;
}

export async function deleteCatalog(catalogId: number): Promise<void> {
  await client.delete(`/bim-modeler/catalogs/${catalogId}`);
}

// ── Panels ──

export async function listPanels(projectId: number): Promise<BimPanelData[]> {
  const res = await client.get(`/bim-modeler/project/${projectId}/panels`);
  return res.data;
}

export async function placePanel(data: {
  project_id: number;
  panel_catalog_id?: number;
  storey_id?: number;
  orientation?: string;
  pos_x_mm: number;
  pos_y_mm?: number;
  pos_z_mm: number;
  rotation_deg?: number;
  pitch_deg?: number;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
}): Promise<BimPanelData> {
  const res = await client.post("/bim-modeler/panels", data);
  return res.data;
}

export async function updatePanel(panelId: number, data: {
  pos_x_mm?: number;
  pos_y_mm?: number;
  pos_z_mm?: number;
  rotation_deg?: number;
  orientation?: string;
  pitch_deg?: number;
  storey_id?: number;
}): Promise<BimPanelData> {
  const res = await client.put(`/bim-modeler/panels/${panelId}`, data);
  return res.data;
}

export async function deletePanel(panelId: number): Promise<void> {
  await client.delete(`/bim-modeler/panels/${panelId}`);
}

export async function addOpening(panelId: number, data: {
  opening_type: string;
  opening_x_mm?: number;
  opening_y_mm?: number;
  opening_width_mm?: number;
  opening_height_mm?: number;
}): Promise<BimPanelData> {
  const res = await client.post(`/bim-modeler/panels/${panelId}/add-opening`, data);
  return res.data;
}

export async function removeOpening(panelId: number): Promise<BimPanelData> {
  const res = await client.delete(`/bim-modeler/panels/${panelId}/remove-opening`);
  return res.data;
}

// ── Storeys ──

export async function listStoreys(projectId: number): Promise<BimStorey[]> {
  const res = await client.get(`/bim-modeler/project/${projectId}/storeys`);
  return res.data;
}

export async function createStorey(projectId: number, data: {
  name: string;
  elevation_mm: number;
  floor_height_mm?: number;
}): Promise<BimStorey> {
  const res = await client.post(`/bim-modeler/project/${projectId}/storeys`, data);
  return res.data;
}

export async function deleteStorey(storeyId: number): Promise<void> {
  await client.delete(`/bim-modeler/storeys/${storeyId}`);
}

// ── Wall groups ──

export async function autoGroupWalls(projectId: number): Promise<WallGroupData[]> {
  const res = await client.post(`/bim-modeler/project/${projectId}/auto-group-walls`);
  return res.data;
}

export async function listWallGroups(projectId: number): Promise<WallGroupData[]> {
  const res = await client.get(`/bim-modeler/project/${projectId}/wall-groups`);
  return res.data;
}

// ── Connections ──

export async function getConnections(projectId: number): Promise<ConnectionData[]> {
  const res = await client.get(`/bim-modeler/project/${projectId}/connections`);
  return res.data;
}

// ── Summary ──

export async function getSummary(projectId: number): Promise<ModularSummary> {
  const res = await client.get(`/bim-modeler/project/${projectId}/summary`);
  return res.data;
}

// ── Framing ──

export interface FramingMemberData {
  member_type: string;
  position_x_mm: number;
  position_y_mm: number;
  length_mm: number;
  width_mm: number;
  depth_mm: number;
  lumber_size: string;
  quantity: number;
  panel_id?: number;
  panel_label?: string;
  world_x_mm?: number;
  world_y_mm?: number;
  world_z_mm?: number;
  panel_rotation_deg?: number;
}

export async function getPanelFraming(panelId: number): Promise<FramingMemberData[]> {
  const res = await client.get(`/bim-modeler/panels/${panelId}/framing`);
  return res.data;
}

export async function getWallFraming(projectId: number): Promise<FramingMemberData[]> {
  const res = await client.get(`/bim-modeler/project/${projectId}/wall-framing`);
  return res.data;
}

// ── Walls (primary design entity) ──

export interface BimWallData {
  id: number;
  project_id: number;
  storey_id: number | null;
  label: string;
  start_x_mm: number;
  start_z_mm: number;
  end_x_mm: number;
  end_z_mm: number;
  height_mm: number;
  thickness_mm: number;
  length_mm: number;
  rotation_deg: number;
  panel_count: number;
  standard_panel_width_mm: number;
  stud_spacing_mm: number;
  openings: BimWallOpeningData[];
}

export interface BimWallOpeningData {
  id: number;
  wall_id: number;
  opening_type: string;
  label: string | null;
  position_along_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
}

export interface WallAssemblyData {
  wall: BimWallData;
  panels: BimPanelData[];
  framing: FramingMemberData[];
  openings: BimWallOpeningData[];
}

export async function drawWall(data: {
  project_id: number;
  start_x_mm: number;
  start_z_mm: number;
  end_x_mm: number;
  end_z_mm: number;
  storey_id?: number;
  height_mm?: number;
  thickness_mm?: number;
  standard_panel_width_mm?: number;
  stud_spacing_mm?: number;
}): Promise<WallAssemblyData> {
  const res = await client.post("/bim-modeler/walls", data);
  return res.data;
}

export async function listWalls(projectId: number): Promise<BimWallData[]> {
  const res = await client.get(`/bim-modeler/project/${projectId}/walls`);
  return res.data;
}

export async function getWallAssembly(wallId: number): Promise<WallAssemblyData> {
  const res = await client.get(`/bim-modeler/walls/${wallId}/assembly`);
  return res.data;
}

export async function updateWall(wallId: number, data: Record<string, unknown>): Promise<WallAssemblyData> {
  const res = await client.put(`/bim-modeler/walls/${wallId}`, data);
  return res.data;
}

export async function deleteWall(wallId: number): Promise<void> {
  await client.delete(`/bim-modeler/walls/${wallId}`);
}

export async function addWallOpening(wallId: number, data: {
  opening_type: string;
  position_along_mm: number;
  position_y_mm?: number;
  width_mm?: number;
  height_mm?: number;
}): Promise<WallAssemblyData> {
  const res = await client.post(`/bim-modeler/walls/${wallId}/openings`, data);
  return res.data;
}

export async function removeWallOpening(wallId: number, openingId: number): Promise<WallAssemblyData> {
  const res = await client.delete(`/bim-modeler/walls/${wallId}/openings/${openingId}`);
  return res.data;
}

// ── Bridge ──

export async function generateElements(projectId: number): Promise<{
  ifc_model_id: number;
  elements_created: number;
  openings_created: number;
}> {
  const res = await client.post(`/bim-modeler/project/${projectId}/generate-elements`);
  return res.data;
}
