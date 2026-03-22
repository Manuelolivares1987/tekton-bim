import client from "./client";
import type {
  PanelScheduleResponse,
  MaterialBOMResponse,
  AssemblySummaryResponse,
} from "../types/api";

export async function getPanelSchedule(projectId: number): Promise<PanelScheduleResponse> {
  const { data } = await client.get(`/assembly-plans/${projectId}/schedule`);
  return data;
}

export async function getMaterialBOM(
  projectId: number,
  wasteFactor: number = 1.1
): Promise<MaterialBOMResponse> {
  const { data } = await client.get(`/assembly-plans/${projectId}/bom`, {
    params: { waste_factor: wasteFactor },
  });
  return data;
}

export async function getAssemblySummary(projectId: number): Promise<AssemblySummaryResponse> {
  const { data } = await client.get(`/assembly-plans/${projectId}/summary`);
  return data;
}

export function getAssemblyPdfUrl(projectId: number, wasteFactor: number = 1.1): string {
  return `/api/v1/assembly-plans/${projectId}/pdf?waste_factor=${wasteFactor}`;
}
