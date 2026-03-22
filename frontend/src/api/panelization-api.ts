import client from "./client";
import type {
  SipPanelConfig,
  WallOpening,
  PanelizationResult,
  PanelInstance,
} from "../types/api";

// --- SIP Panel Configs ---

export async function createSipConfig(data: Omit<SipPanelConfig, "id" | "created_at" | "updated_at">): Promise<SipPanelConfig> {
  const res = await client.post("/panelization/sip-configs", data);
  return res.data;
}

export async function listSipConfigs(projectId: number): Promise<SipPanelConfig[]> {
  const res = await client.get("/panelization/sip-configs", { params: { project_id: projectId } });
  return res.data;
}

export async function getSipConfig(configId: number): Promise<SipPanelConfig> {
  const res = await client.get(`/panelization/sip-configs/${configId}`);
  return res.data;
}

export async function updateSipConfig(configId: number, data: Partial<SipPanelConfig>): Promise<SipPanelConfig> {
  const res = await client.put(`/panelization/sip-configs/${configId}`, data);
  return res.data;
}

export async function deleteSipConfig(configId: number): Promise<void> {
  await client.delete(`/panelization/sip-configs/${configId}`);
}

// --- Wall Openings ---

export async function getWallOpenings(elementId: number): Promise<WallOpening[]> {
  const res = await client.get(`/panelization/walls/${elementId}/openings`);
  return res.data;
}

export async function addWallOpening(elementId: number, data: {
  ifc_element_id: number;
  opening_type: string;
  position_x_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
}): Promise<WallOpening> {
  const res = await client.post(`/panelization/walls/${elementId}/openings`, data);
  return res.data;
}

export async function deleteWallOpening(openingId: number): Promise<void> {
  await client.delete(`/panelization/walls/openings/${openingId}`);
}

export async function detectOpeningsFromIfc(elementId: number): Promise<WallOpening[]> {
  const res = await client.post(`/panelization/walls/${elementId}/detect-openings`);
  return res.data;
}

// --- Panelization ---

export async function panelizeWall(elementId: number, data: {
  sip_config_id: number;
  wall_prefix?: string;
}): Promise<PanelizationResult> {
  const res = await client.post(`/panelization/walls/${elementId}/panelize`, data);
  return res.data;
}

export async function getWallPanelization(elementId: number, projectId: number): Promise<PanelizationResult> {
  const res = await client.get(`/panelization/walls/${elementId}/result`, { params: { project_id: projectId } });
  return res.data;
}

export async function bulkPanelize(data: {
  project_id: number;
  model_id: number;
  sip_config_id: number;
  storey_filter?: string;
}): Promise<{ walls_panelized: number; total_panels: number }> {
  const res = await client.post("/panelization/bulk-panelize", data);
  return res.data;
}

export async function listPanelizationResults(projectId: number): Promise<PanelizationResult[]> {
  const res = await client.get(`/panelization/results/${projectId}`);
  return res.data;
}

export async function getPanelInstances(resultId: number): Promise<PanelInstance[]> {
  const res = await client.get(`/panelization/instances/${resultId}`);
  return res.data;
}

export async function deletePanelization(resultId: number): Promise<void> {
  await client.delete(`/panelization/results/${resultId}`);
}

export async function confirmPanelization(resultId: number): Promise<void> {
  await client.post(`/panelization/results/${resultId}/confirm`);
}
