import client from "./client";
import type { IfcModel, IfcElement, IfcModelSummary } from "../types/api";

export async function uploadIfc(
  projectId: number,
  file: File
): Promise<{ model_id: number; element_count: number; parse_time_seconds: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post(`/ifc/upload?project_id=${projectId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000, // 5 min for large files
  });
  return data;
}

export async function listModels(projectId?: number): Promise<IfcModel[]> {
  const params = projectId ? { project_id: projectId } : {};
  const { data } = await client.get("/ifc/models", { params });
  return data;
}

export async function getModelSummary(modelId: number): Promise<IfcModelSummary> {
  const { data } = await client.get(`/ifc/models/${modelId}/summary`);
  return data;
}

export async function listElements(
  modelId: number,
  params?: { ifc_type?: string; storey?: string; page?: number; limit?: number }
): Promise<IfcElement[]> {
  const { data } = await client.get(`/ifc/models/${modelId}/elements`, { params });
  return data;
}

export async function deleteModel(modelId: number): Promise<void> {
  await client.delete(`/ifc/models/${modelId}`);
}

export function getModelFileUrl(modelId: number): string {
  return `/api/v1/ifc/models/${modelId}/file`;
}
