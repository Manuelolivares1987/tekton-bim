import client from "./client";
import type { PanelAssignment, PanelAssignmentWithDetails } from "../types/api";

export async function createAssignment(body: {
  project_id: number;
  ifc_element_id: number;
  panel_id: number;
  notes?: string;
}): Promise<PanelAssignment> {
  const { data } = await client.post("/panel-assignments", body);
  return data;
}

export async function bulkAssign(body: {
  project_id: number;
  ifc_element_ids: number[];
  panel_id: number;
  notes?: string;
}): Promise<PanelAssignment[]> {
  const { data } = await client.post("/panel-assignments/bulk", body);
  return data;
}

export async function listAssignments(projectId: number): Promise<PanelAssignmentWithDetails[]> {
  const { data } = await client.get("/panel-assignments", { params: { project_id: projectId } });
  return data;
}

export async function getAssignment(id: number): Promise<PanelAssignment> {
  const { data } = await client.get(`/panel-assignments/${id}`);
  return data;
}

export async function updateAssignment(
  id: number,
  body: { panel_id?: number; panel_number?: string; notes?: string }
): Promise<PanelAssignment> {
  const { data } = await client.put(`/panel-assignments/${id}`, body);
  return data;
}

export async function deleteAssignment(id: number): Promise<void> {
  await client.delete(`/panel-assignments/${id}`);
}
