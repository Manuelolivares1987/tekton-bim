import { useState, useEffect } from "react";
import {
  Layers,
  Play,
  CheckCircle,
  Trash2,
  RefreshCw,
  DoorOpen,
  Info,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useIfcStore } from "../../store/ifc-store";
import { usePanelizationStore } from "../../store/panelization-store";
import type { SipPanelConfig, PanelInstance, PanelizationResult, IfcElement } from "../../types/api";
import * as panelApi from "../../api/panelization-api";
import client from "../../api/client";
import SipConfigForm from "./SipConfigForm";
import PanelLayoutCanvas from "./PanelLayoutCanvas";

export default function SipPanelization() {
  const { currentProjectId } = useProjectStore();
  const { models, currentModelId, fetchModels } = useIfcStore();
  const {
    results,
    currentResult,
    fetchResults,
    setCurrentResult,
    selectedWallId,
    setSelectedWall,
    openings,
    fetchOpenings,
    clearOpenings,
  } = usePanelizationStore();

  const [walls, setWalls] = useState<IfcElement[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SipPanelConfig | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<PanelInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [storeyFilter, setStoreyFilter] = useState<string>("");
  const [storeys, setStoreys] = useState<string[]>([]);

  // Fetch models and walls when project changes
  useEffect(() => {
    if (currentProjectId) {
      fetchModels(currentProjectId);
      fetchResults(currentProjectId);
    }
  }, [currentProjectId, fetchModels, fetchResults]);

  // Fetch walls when model changes
  useEffect(() => {
    if (currentModelId) {
      client
        .get(`/ifc/models/${currentModelId}/elements`, {
          params: { ifc_type: "IfcWall", limit: 500 },
        })
        .then((res) => {
          const wallElements = res.data.elements || res.data;
          setWalls(Array.isArray(wallElements) ? wallElements : []);
        });

      client.get(`/ifc/models/${currentModelId}/summary`).then((res) => {
        setStoreys(res.data.storeys || []);
      });
    }
  }, [currentModelId]);

  // Fetch IfcWallStandardCase too
  useEffect(() => {
    if (currentModelId) {
      client
        .get(`/ifc/models/${currentModelId}/elements`, {
          params: { ifc_type: "IfcWallStandardCase", limit: 500 },
        })
        .then((res) => {
          const extra = res.data.elements || res.data;
          if (Array.isArray(extra) && extra.length > 0) {
            setWalls((prev) => [...prev, ...extra]);
          }
        });
    }
  }, [currentModelId]);

  // Fetch openings when wall selected
  useEffect(() => {
    if (selectedWallId) {
      fetchOpenings(selectedWallId);
    } else {
      clearOpenings();
    }
  }, [selectedWallId, fetchOpenings, clearOpenings]);

  // Find result for selected wall
  useEffect(() => {
    if (selectedWallId && currentProjectId) {
      const wallResult = results.find((r) => r.ifc_element_id === selectedWallId);
      if (wallResult) {
        // Fetch full result with panels
        panelApi
          .getWallPanelization(selectedWallId, currentProjectId)
          .then((r) => setCurrentResult(r))
          .catch(() => setCurrentResult(null));
      } else {
        setCurrentResult(null);
      }
    }
  }, [selectedWallId, results, currentProjectId, setCurrentResult]);

  const handlePanelize = async () => {
    if (!selectedWallId || !selectedConfig) return;
    setLoading(true);
    try {
      const result = await panelApi.panelizeWall(selectedWallId, {
        sip_config_id: selectedConfig.id,
      });
      setCurrentResult(result);
      if (currentProjectId) fetchResults(currentProjectId);
    } catch (err) {
      console.error("Error panelizing:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPanelize = async () => {
    if (!currentProjectId || !currentModelId || !selectedConfig) return;
    setBulkLoading(true);
    try {
      await panelApi.bulkPanelize({
        project_id: currentProjectId,
        model_id: currentModelId,
        sip_config_id: selectedConfig.id,
        storey_filter: storeyFilter || undefined,
      });
      fetchResults(currentProjectId);
    } catch (err) {
      console.error("Error bulk panelizing:", err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDetectOpenings = async () => {
    if (!selectedWallId) return;
    try {
      await panelApi.detectOpeningsFromIfc(selectedWallId);
      fetchOpenings(selectedWallId);
    } catch (err) {
      console.error("Error detecting openings:", err);
    }
  };

  const handleDeleteResult = async () => {
    if (!currentResult) return;
    await panelApi.deletePanelization(currentResult.id);
    setCurrentResult(null);
    if (currentProjectId) fetchResults(currentProjectId);
  };

  const handleConfirmResult = async () => {
    if (!currentResult) return;
    await panelApi.confirmPanelization(currentResult.id);
    if (currentProjectId) fetchResults(currentProjectId);
  };

  const selectedWall = walls.find((w) => w.id === selectedWallId);
  const filteredWalls = storeyFilter
    ? walls.filter((w) => w.storey_name === storeyFilter)
    : walls;

  const panelizedWallIds = new Set(results.map((r) => r.ifc_element_id));

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        <p>Selecciona un proyecto para comenzar</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Left sidebar: Config + Wall list */}
      <div className="w-72 flex-shrink-0 overflow-y-auto space-y-4">
        {/* SIP Config */}
        <SipConfigForm
          projectId={currentProjectId}
          onConfigSelect={setSelectedConfig}
        />

        {/* Storey filter */}
        {storeys.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">
              Filtrar por piso
            </label>
            <select
              value={storeyFilter}
              onChange={(e) => setStoreyFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded mt-1"
            >
              <option value="">Todos los pisos</option>
              {storeys.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Bulk panelize */}
        {selectedConfig && currentModelId && (
          <button
            onClick={handleBulkPanelize}
            disabled={bulkLoading}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-[var(--primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
            Panelizar Todos los Muros
          </button>
        )}

        {/* Wall list */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
            Muros ({filteredWalls.length})
          </h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filteredWalls.map((wall) => {
              const isPanelized = panelizedWallIds.has(wall.id);
              return (
                <button
                  key={wall.id}
                  onClick={() => {
                    setSelectedWall(wall.id);
                    setSelectedPanel(null);
                  }}
                  className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded transition-colors ${
                    selectedWallId === wall.id
                      ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "hover:bg-[var(--secondary)] text-[var(--foreground)]"
                  }`}
                >
                  <div className="text-left truncate flex-1">
                    <div className="truncate">{wall.name || `Muro ${wall.global_id.slice(0, 8)}`}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {wall.storey_name} | {((wall.length_m || 0) * 1000).toFixed(0)}x{((wall.height_m || 0) * 1000).toFixed(0)}mm
                    </div>
                  </div>
                  {isPanelized && (
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
            {filteredWalls.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
                No se encontraron muros. Importa un archivo IFC primero.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main content: Panel layout */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers size={24} className="text-[var(--primary)]" />
            <div>
              <h2 className="text-xl font-bold">Panelización SIP</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Divide muros en paneles SIP fabricables
              </p>
            </div>
          </div>
        </div>

        {/* Selected wall info */}
        {selectedWall && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {selectedWall.name || `Muro ${selectedWall.global_id.slice(0, 8)}`}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDetectOpenings}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--secondary)] rounded hover:bg-[var(--secondary)]/80"
                  title="Detectar vanos del IFC"
                >
                  <DoorOpen size={14} />
                  Detectar Vanos
                </button>
                {selectedConfig && (
                  <button
                    onClick={handlePanelize}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Panelizar
                  </button>
                )}
              </div>
            </div>

            {/* Wall stats */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-[var(--secondary)] rounded p-2">
                <div className="text-lg font-bold">{((selectedWall.length_m || 0) * 1000).toFixed(0)}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Largo (mm)</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-2">
                <div className="text-lg font-bold">{((selectedWall.height_m || 0) * 1000).toFixed(0)}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Alto (mm)</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-2">
                <div className="text-lg font-bold">{openings.length}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Vanos</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-2">
                <div className="text-lg font-bold">{currentResult?.panel_count || 0}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Paneles</div>
              </div>
            </div>
          </div>
        )}

        {/* Panel layout canvas */}
        {selectedWall && currentResult && currentResult.panels.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Layout de Paneles</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded ${
                  currentResult.status === "confirmed"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {currentResult.status === "confirmed" ? "Confirmado" : "Borrador"}
                </span>
                {currentResult.status === "draft" && (
                  <button
                    onClick={handleConfirmResult}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20"
                  >
                    <CheckCircle size={12} />
                    Confirmar
                  </button>
                )}
                <button
                  onClick={handleDeleteResult}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20"
                >
                  <Trash2 size={12} />
                  Eliminar
                </button>
              </div>
            </div>

            <PanelLayoutCanvas
              wallLengthMm={currentResult.wall_length_mm || 0}
              wallHeightMm={currentResult.wall_height_mm || 0}
              panels={currentResult.panels}
              openings={openings}
              selectedPanelId={selectedPanel?.id || null}
              onPanelClick={setSelectedPanel}
            />

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted-foreground)]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/40"></div> Estándar
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-500/40"></div> Corte
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-500/40"></div> Dintel
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-cyan-500/40"></div> Alféizar
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500/40"></div> Vano
              </div>
            </div>
          </div>
        )}

        {/* Panel summary */}
        {currentResult && currentResult.panels.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Resumen de Paneles</h3>
              <div className="text-sm text-[var(--muted-foreground)]">
                {currentResult.total_area_m2.toFixed(2)} m² | {currentResult.total_weight_kg.toFixed(1)} kg
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                    <th className="py-2 px-2">Etiqueta</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2 text-right">Ancho (mm)</th>
                    <th className="py-2 px-2 text-right">Alto (mm)</th>
                    <th className="py-2 px-2 text-right">Area (m²)</th>
                    <th className="py-2 px-2 text-right">Peso (kg)</th>
                    <th className="py-2 px-2 text-center">Corte</th>
                    <th className="py-2 px-2 text-center">Vano</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResult.panels.map((panel) => (
                    <tr
                      key={panel.id}
                      onClick={() => setSelectedPanel(panel)}
                      className={`cursor-pointer border-b border-[var(--border)]/50 transition-colors ${
                        selectedPanel?.id === panel.id
                          ? "bg-[var(--primary)]/10"
                          : "hover:bg-[var(--secondary)]"
                      }`}
                    >
                      <td className="py-1.5 px-2 font-mono font-semibold">{panel.panel_label}</td>
                      <td className="py-1.5 px-2 capitalize">{panel.panel_type}</td>
                      <td className="py-1.5 px-2 text-right">{Math.round(panel.width_mm)}</td>
                      <td className="py-1.5 px-2 text-right">{Math.round(panel.height_mm)}</td>
                      <td className="py-1.5 px-2 text-right">{panel.area_m2.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right">{panel.weight_kg.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-center">
                        {panel.is_custom_cut ? "Si" : "-"}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {panel.has_opening ? panel.opening_type : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected panel details */}
        {selectedPanel && (
          <div className="bg-[var(--card)] border border-[var(--primary)]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-[var(--primary)]" />
              <h3 className="font-semibold">Panel {selectedPanel.panel_label}</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">Dimensiones:</span>
                <span className="ml-2 font-mono">
                  {Math.round(selectedPanel.width_mm)} x {Math.round(selectedPanel.height_mm)} mm
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Area neta:</span>
                <span className="ml-2 font-mono">{selectedPanel.area_m2.toFixed(3)} m²</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Peso:</span>
                <span className="ml-2 font-mono">{selectedPanel.weight_kg.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Posición X:</span>
                <span className="ml-2 font-mono">{Math.round(selectedPanel.position_x_mm)} mm</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Tipo:</span>
                <span className="ml-2 capitalize">{selectedPanel.panel_type}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Corte custom:</span>
                <span className="ml-2">{selectedPanel.is_custom_cut ? "Si" : "No"}</span>
              </div>
              {selectedPanel.has_opening && (
                <>
                  <div className="col-span-3 border-t border-[var(--border)] pt-2 mt-1">
                    <span className="text-[var(--muted-foreground)] font-semibold">Vano:</span>
                    <span className="ml-2 capitalize">{selectedPanel.opening_type}</span>
                    <span className="ml-4 font-mono">
                      {Math.round(selectedPanel.opening_width_mm || 0)} x {Math.round(selectedPanel.opening_height_mm || 0)} mm
                    </span>
                    <span className="ml-4 text-[var(--muted-foreground)]">en posición</span>
                    <span className="ml-1 font-mono">
                      ({Math.round(selectedPanel.opening_x_mm || 0)}, {Math.round(selectedPanel.opening_y_mm || 0)})
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedWall && (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--muted-foreground)]">
            <Layers size={48} className="mb-4 opacity-30" />
            <p className="text-lg">Selecciona un muro para panelizar</p>
            <p className="text-sm mt-1">
              Elige una configuración SIP y un muro de la lista lateral
            </p>
          </div>
        )}

        {selectedWall && !currentResult && (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] rounded-lg">
            <RefreshCw size={32} className="mb-3 opacity-30" />
            <p>Este muro aún no está panelizado</p>
            <p className="text-sm mt-1">
              {selectedConfig
                ? 'Haz click en "Panelizar" para generar los paneles'
                : "Selecciona una configuración SIP primero"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
