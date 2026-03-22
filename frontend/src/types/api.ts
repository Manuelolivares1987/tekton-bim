// API Types matching backend Pydantic schemas

export interface Project {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface IfcModel {
  id: number;
  project_id: number;
  file_name: string;
  file_size_bytes: number | null;
  ifc_schema: string | null;
  authoring_tool: string | null;
  element_count: number;
  parsed_at: string | null;
  created_at: string;
}

export interface IfcElement {
  id: number;
  global_id: string;
  ifc_type: string;
  name: string | null;
  description: string | null;
  storey_name: string | null;
  type_name: string | null;
  length_m: number | null;
  height_m: number | null;
  width_m: number | null;
  gross_area_m2: number | null;
  net_area_m2: number | null;
  volume_m3: number | null;
}

export interface IfcModelSummary {
  model_id: number;
  file_name: string;
  ifc_schema: string | null;
  element_count: number;
  elements_by_type: Record<string, number>;
  storeys: string[];
}

export interface QuantityTakeoffItem {
  category: string;
  ifc_type: string;
  type_name: string | null;
  count: number;
  total_area_m2: number | null;
  total_volume_m3: number | null;
  total_length_m: number | null;
}

export interface QuantityTakeoffResponse {
  model_id: number;
  items: QuantityTakeoffItem[];
  total_elements: number;
}

export interface WallAreaResult {
  model_id: number;
  total_gross_area_m2: number;
  total_net_area_m2: number;
  by_storey: Record<string, number>;
  by_type: Record<string, number>;
  wall_count: number;
}

export interface VolcanicRockResult {
  method: string;
  area_m2?: number;
  thickness_mm?: number;
  volume_m3?: number;
  weight_kg: number;
  weight_with_waste_kg?: number;
  density_kg_m3?: number;
  panel_type_name?: string;
  quantity?: number;
  kg_per_unit?: number;
}

export interface Material {
  id: number;
  name: string;
  category: string;
  density_kg_m3: number | null;
  thermal_conductivity_w_mk: number | null;
  cost_per_unit: number | null;
  cost_unit: string;
  description: string | null;
  is_volcanic_rock: boolean;
  created_at: string;
}

export interface PanelLayer {
  id: number;
  material_id: number;
  layer_order: number;
  thickness_mm: number;
  description: string | null;
}

export interface Panel {
  id: number;
  project_id: number | null;
  name: string;
  category: string;
  description: string | null;
  total_thickness_mm: number | null;
  total_weight_per_m2_kg: number | null;
  r_value_m2k_w: number | null;
  volcanic_rock_kg_per_unit: number | null;
  layers: PanelLayer[];
  created_at: string;
  updated_at: string;
}

export interface LoadCalculationResult {
  current_amps: number;
  adjusted_amps: number;
  recommended_breaker_amps: number;
  recommended_wire_size: string;
}

export interface WireSizingResult {
  wire_size_awg: string;
  ampacity: number;
  voltage_drop_pct: number;
  voltage_drop_volts: number;
}

export interface PipeSizingResult {
  nominal_size: string;
  diameter_inches: number;
  diameter_mm: number;
  actual_velocity_fps: number;
  flow_gpm: number;
}

export interface PressureCalcResult {
  supply_pressure_psi: number;
  static_loss_psi: number;
  friction_loss_psi: number;
  available_pressure_psi: number;
  min_fixture_pressure_psi: number;
  is_adequate: boolean;
  flow_gpm: number;
  total_fixture_units: number;
}

// Panel Assignment types
export interface PanelAssignment {
  id: number;
  project_id: number;
  ifc_element_id: number;
  panel_id: number;
  panel_number: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PanelAssignmentWithDetails {
  id: number;
  project_id: number;
  ifc_element_id: number;
  panel_id: number;
  panel_number: string;
  notes: string | null;
  element_name: string | null;
  element_global_id: string;
  element_ifc_type: string;
  element_storey: string | null;
  element_gross_area_m2: number | null;
  panel_name: string;
  panel_category: string;
  created_at: string;
  updated_at: string;
}

// Assembly Plan types
export interface PanelScheduleItem {
  panel_number: string;
  panel_name: string;
  panel_category: string;
  element_name: string | null;
  element_ifc_type: string;
  storey: string | null;
  width_m: number | null;
  height_m: number | null;
  thickness_mm: number | null;
  area_m2: number | null;
  weight_kg: number | null;
  notes: string | null;
}

export interface PanelScheduleResponse {
  project_id: number;
  items: PanelScheduleItem[];
  total_panels: number;
}

export interface MaterialBOMItem {
  material_name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_per_unit: number | null;
  total_cost: number | null;
}

export interface MaterialBOMResponse {
  project_id: number;
  items: MaterialBOMItem[];
  waste_factor: number;
  total_cost: number;
}

export interface AssemblySummaryResponse {
  project_id: number;
  total_panels: number;
  total_area_m2: number;
  by_panel_type: Record<string, number>;
  by_storey: Record<string, number>;
  total_material_cost: number;
}

// SIP Panelization types
export interface SipPanelConfig {
  id: number;
  project_id: number;
  name: string;
  core_material_id: number;
  core_thickness_mm: number;
  skin_material_id: number;
  skin_thickness_mm: number;
  standard_width_mm: number;
  standard_height_mm: number;
  max_width_mm: number;
  max_height_mm: number;
  min_panel_width_mm: number;
  joint_type: string;
  spline_material_id: number | null;
  spline_width_mm: number;
  spline_depth_mm: number;
  created_at: string;
  updated_at: string;
}

export interface WallOpening {
  id: number;
  ifc_element_id: number;
  opening_ifc_element_id: number | null;
  opening_type: string;
  position_x_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
  rough_opening_width_mm: number;
  rough_opening_height_mm: number;
  created_at: string;
}

export interface PanelInstance {
  id: number;
  panel_label: string;
  sequence_order: number;
  position_x_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
  is_custom_cut: boolean;
  has_opening: boolean;
  opening_type: string | null;
  opening_x_mm: number | null;
  opening_y_mm: number | null;
  opening_width_mm: number | null;
  opening_height_mm: number | null;
  panel_type: string;
  weight_kg: number;
  area_m2: number;
  notes: string | null;
}

export interface PanelizationResult {
  id: number;
  project_id: number;
  ifc_element_id: number;
  config_type: string;
  sip_config_id: number | null;
  status: string;
  wall_name: string | null;
  wall_length_mm: number | null;
  wall_height_mm: number | null;
  storey: string | null;
  panel_count: number;
  total_area_m2: number;
  total_weight_kg: number;
  panels: PanelInstance[];
  created_at: string;
  updated_at: string;
}

// Floor Plan types
export interface FloorPlanOpening {
  id: number;
  wall_id: number;
  opening_type: string;
  position_along_wall_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
}

export interface FloorPlanWall {
  id: number;
  storey_id: number;
  start_x_mm: number;
  start_y_mm: number;
  end_x_mm: number;
  end_y_mm: number;
  thickness_mm: number;
  height_mm: number | null;
  length_mm: number;
  label: string | null;
  ifc_element_id: number | null;
  openings: FloorPlanOpening[];
}

export interface FloorPlanStorey {
  id: number;
  name: string;
  level_index: number;
  elevation_mm: number;
  height_mm: number;
  walls: FloorPlanWall[];
}

export interface FloorPlan {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  grid_size_mm: number;
  default_wall_thickness_mm: number;
  default_wall_height_mm: number;
  ifc_model_id: number | null;
  storeys: FloorPlanStorey[];
  created_at: string;
  updated_at: string;
}
