import client from "./client";
import type { FloorPlan, FloorPlanWall, FloorPlanOpening, FloorPlanStorey } from "../types/api";

export async function createFloorPlan(data: {
  project_id: number;
  name: string;
  default_wall_thickness_mm?: number;
  default_wall_height_mm?: number;
}): Promise<FloorPlan> {
  const res = await client.post("/floor-plans", data);
  return res.data;
}

export async function listFloorPlans(projectId: number): Promise<FloorPlan[]> {
  const res = await client.get("/floor-plans", { params: { project_id: projectId } });
  return res.data;
}

export async function getFloorPlan(planId: number): Promise<FloorPlan> {
  const res = await client.get(`/floor-plans/${planId}`);
  return res.data;
}

export async function deleteFloorPlan(planId: number): Promise<void> {
  await client.delete(`/floor-plans/${planId}`);
}

export async function addStorey(planId: number, data: {
  name: string;
  level_index: number;
  height_mm?: number;
}): Promise<FloorPlanStorey> {
  const res = await client.post(`/floor-plans/${planId}/storeys`, data);
  return res.data;
}

export async function deleteStorey(planId: number, storeyId: number): Promise<void> {
  await client.delete(`/floor-plans/${planId}/storeys/${storeyId}`);
}

export async function addWall(planId: number, storeyId: number, data: {
  start_x_mm: number;
  start_y_mm: number;
  end_x_mm: number;
  end_y_mm: number;
  thickness_mm?: number;
}): Promise<FloorPlanWall> {
  const res = await client.post(`/floor-plans/${planId}/storeys/${storeyId}/walls`, data);
  return res.data;
}

export async function updateWall(planId: number, wallId: number, data: Partial<FloorPlanWall>): Promise<FloorPlanWall> {
  const res = await client.put(`/floor-plans/${planId}/walls/${wallId}`, data);
  return res.data;
}

export async function deleteWall(planId: number, wallId: number): Promise<void> {
  await client.delete(`/floor-plans/${planId}/walls/${wallId}`);
}

export async function addOpening(planId: number, wallId: number, data: {
  opening_type: string;
  position_along_wall_mm: number;
  position_y_mm?: number;
  width_mm: number;
  height_mm: number;
}): Promise<FloorPlanOpening> {
  const res = await client.post(`/floor-plans/${planId}/walls/${wallId}/openings`, data);
  return res.data;
}

export async function deleteOpening(planId: number, openingId: number): Promise<void> {
  await client.delete(`/floor-plans/${planId}/openings/${openingId}`);
}

export async function bulkSaveStorey(planId: number, storeyId: number, walls: any[]): Promise<void> {
  await client.put(`/floor-plans/${planId}/storeys/${storeyId}/bulk-save`, { walls });
}

export async function generateElements(planId: number): Promise<{
  ifc_model_id: number;
  elements_created: number;
  openings_created: number;
}> {
  const res = await client.post(`/floor-plans/${planId}/generate-elements`);
  return res.data;
}

export async function get3DData(planId: number): Promise<any> {
  const res = await client.get(`/floor-plans/${planId}/3d-data`);
  return res.data;
}
