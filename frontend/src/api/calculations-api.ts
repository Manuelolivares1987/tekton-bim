import client from "./client";
import type {
  QuantityTakeoffResponse,
  WallAreaResult,
  VolcanicRockResult,
} from "../types/api";

export async function runQuantityTakeoff(
  modelId: number
): Promise<QuantityTakeoffResponse> {
  const { data } = await client.post("/calculations/quantity-takeoff", {
    model_id: modelId,
  });
  return data;
}

export async function exportQuantityTakeoffCsv(modelId: number): Promise<Blob> {
  const { data } = await client.post(
    "/calculations/quantity-takeoff/export",
    { model_id: modelId },
    { responseType: "blob" }
  );
  return data;
}

export async function calculateWallArea(
  modelId: number,
  includeOpenings: boolean = true
): Promise<WallAreaResult> {
  const { data } = await client.post("/calculations/wall-area", {
    model_id: modelId,
    include_openings: includeOpenings,
  });
  return data;
}

export async function calculateVolcanicRockByArea(params: {
  model_id?: number;
  wall_area_m2?: number;
  thickness_mm: number;
  density_kg_m3: number;
  waste_factor_pct: number;
}): Promise<VolcanicRockResult> {
  const { data } = await client.post("/calculations/volcanic-rock/by-area", params);
  return data;
}

export async function calculateVolcanicRockByPanel(
  panelTypeId: number,
  quantity: number
): Promise<VolcanicRockResult> {
  const { data } = await client.post("/calculations/volcanic-rock/by-panel", {
    panel_type_id: panelTypeId,
    quantity,
  });
  return data;
}
