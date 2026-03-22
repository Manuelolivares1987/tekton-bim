import client from "./client";

export interface BoardType {
  name: string;
  width_m: number;
  height_m: number;
  area_m2: number;
  description: string;
}

export interface WallCoverageItem {
  element_id: number;
  name: string;
  storey: string;
  wall_length_m: number | null;
  wall_height_m: number | null;
  wall_area_m2: number;
  coverage_area_m2: number;
  boards_needed: number;
  boards_horizontal: number;
  boards_vertical: number;
}

export interface StoreyCoverage {
  storey: string;
  wall_count: number;
  total_area_m2: number;
  boards_needed: number;
}

export interface BoardCoverageResponse {
  model_id: number;
  board_type: string;
  board_name: string;
  board_width_m: number;
  board_height_m: number;
  board_area_m2: number;
  waste_factor: number;
  both_sides: boolean;
  wall_count: number;
  total_wall_area_m2: number;
  total_boards_needed: number;
  total_board_area_m2: number;
  coverage_efficiency_pct: number;
  by_storey: StoreyCoverage[];
  walls: WallCoverageItem[];
}

export async function listBoardTypes(): Promise<Record<string, BoardType>> {
  const { data } = await client.get("/board-coverage/boards");
  return data;
}

export async function getBoardCoverage(
  modelId: number,
  params: {
    board_type?: string;
    waste_factor?: number;
    both_sides?: boolean;
    custom_width_m?: number;
    custom_height_m?: number;
  } = {}
): Promise<BoardCoverageResponse> {
  const { data } = await client.get(`/board-coverage/${modelId}/coverage`, { params });
  return data;
}
