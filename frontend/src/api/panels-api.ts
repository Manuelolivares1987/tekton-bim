import client from "./client";
import type { Panel, Material } from "../types/api";

// Panels
export async function listPanels(projectId?: number): Promise<Panel[]> {
  const params = projectId ? { project_id: projectId } : {};
  const { data } = await client.get("/panels", { params });
  return data;
}

export async function createPanel(body: {
  name: string;
  category: string;
  project_id?: number;
  description?: string;
  volcanic_rock_kg_per_unit?: number;
  layers?: Array<{
    material_id: number;
    layer_order: number;
    thickness_mm: number;
    description?: string;
  }>;
}): Promise<Panel> {
  const { data } = await client.post("/panels", body);
  return data;
}

export async function getPanel(id: number): Promise<Panel> {
  const { data } = await client.get(`/panels/${id}`);
  return data;
}

export async function updatePanel(
  id: number,
  body: {
    name?: string;
    category?: string;
    description?: string;
    volcanic_rock_kg_per_unit?: number;
  }
): Promise<Panel> {
  const { data } = await client.put(`/panels/${id}`, body);
  return data;
}

export async function deletePanel(id: number): Promise<void> {
  await client.delete(`/panels/${id}`);
}

export async function addLayer(
  panelId: number,
  body: {
    material_id: number;
    layer_order: number;
    thickness_mm: number;
    description?: string;
  }
): Promise<void> {
  await client.post(`/panels/${panelId}/layers`, body);
}

export async function deleteLayer(
  panelId: number,
  layerId: number
): Promise<void> {
  await client.delete(`/panels/${panelId}/layers/${layerId}`);
}

// Materials
export async function listMaterials(category?: string): Promise<Material[]> {
  const params = category ? { category } : {};
  const { data } = await client.get("/materials", { params });
  return data;
}

export async function createMaterial(body: {
  name: string;
  category: string;
  density_kg_m3?: number;
  thermal_conductivity_w_mk?: number;
  description?: string;
  is_volcanic_rock?: boolean;
}): Promise<Material> {
  const { data } = await client.post("/materials", body);
  return data;
}
