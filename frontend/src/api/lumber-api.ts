import client from "./client";

export interface LumberSizeItem {
  lumber_size: string;
  count: number;
  total_length_m: number;
  total_length_ft: number;
  total_volume_m3: number;
  board_feet: number;
  length_with_waste_m: number;
  board_feet_with_waste: number;
}

export interface LumberStoreyItem {
  storey: string;
  count: number;
  total_length_m: number;
  total_volume_m3: number;
}

export interface LumberTakeoffResponse {
  model_id: number;
  waste_factor: number;
  total_lumber_pieces: number;
  total_length_m: number;
  total_length_ft: number;
  total_volume_m3: number;
  total_board_feet: number;
  total_length_with_waste_m: number;
  total_volume_with_waste_m3: number;
  total_board_feet_with_waste: number;
  by_size: LumberSizeItem[];
  by_storey: LumberStoreyItem[];
  by_ifc_type: Record<string, number>;
  non_lumber_framing: number;
}

export async function getLumberTakeoff(
  modelId: number,
  wasteFactor: number = 1.1
): Promise<LumberTakeoffResponse> {
  const { data } = await client.get(`/lumber-takeoff/${modelId}/lumber`, {
    params: { waste_factor: wasteFactor },
  });
  return data;
}
