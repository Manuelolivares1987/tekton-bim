import { useState, useEffect } from "react";
import {
  PenTool,
  MousePointer,
  DoorOpen,
  Square,
  Eraser,
  Move,
  Plus,
  Trash2,
  Play,
  Box,
  Grid3X3,
  Loader2,
  ArrowRight,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { useIfcStore } from "../../store/ifc-store";
import { useFloorPlanStore, type FloorPlanTool } from "../../store/floor-plan-store";
import * as floorPlanApi from "../../api/floor-plan-api";
import FloorPlanCanvas from "./FloorPlanCanvas";

const TOOLS: { id: FloorPlanTool; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: "select", label: "Seleccionar", icon: <MousePointer size={16} />, shortcut: "V" },
  { id: "draw-wall", label: "Dibujar Muro", icon: <PenTool size={16} />, shortcut: "W" },
  { id: "door", label: "Puerta", icon: <DoorOpen size={16} />, shortcut: "D" },
  { id: "window", label: "Ventana", icon: <Square size={16} />, shortcut: "N" },
  { id: "eraser", label: "Borrar", icon: <Eraser size={16} />, shortcut: "E" },
  { id: "pan", label: "Mover", icon: <Move size={16} />, shortcut: "H" },
];

export default function FloorPlanEditor() {
  const { currentProjectId } = useProjectStore();
  const { setActiveView } = useUIStore();
  const { selectModel } = useIfcStore();
  const {
    plans,
    currentPlan,
    currentStoreyId,
    activeTool,
    gridSize,
    wallThickness,
    selectedWallId,
    viewMode,
    fetchPlans,
    createPlan,
    loadPlan,
    deletePlan,
    setCurrentStorey,
    setTool,
    setGridSize,
    setWallThickness,
    setSelectedWall,
    deleteWallFromStorey,
    deleteOpeningFromWall,
    setViewMode,
  } = useFloorPlanStore();

  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (currentProjectId) {
      fetchPlans(currentProjectId);
    }
  }, [currentProjectId, fetchPlans]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toUpperCase();
      const tool = TOOLS.find((t) => t.shortcut === key);
      if (tool) setTool(tool.id);
      if (key === "DELETE" && selectedWallId) deleteWallFromStorey(selectedWallId);
      if (key === "ESCAPE") {
        setTool("select");
        setSelectedWall(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setTool, selectedWallId, deleteWallFromStorey, setSelectedWall]);

  const handleCreatePlan = async () => {
    if (!currentProjectId || !newPlanName.trim()) return;
    await createPlan(currentProjectId, newPlanName.trim());
    setNewPlanName("");
    setShowNewPlan(false);
  };

  const handleGenerateElements = async () => {
    if (!currentPlan) return;
    setGenerating(true);
    try {
      const result = await floorPlanApi.generateElements(currentPlan.id);
      // Switch to panelization view with generated model
      if (result.ifc_model_id) {
        await selectModel(result.ifc_model_id);
      }
      alert(
        `Elementos generados: ${result.elements_created} muros, ${result.openings_created} vanos.\n` +
        `Ahora puedes ir a "Panelización SIP" para panelizar.`
      );
    } catch (err) {
      console.error("Error generating elements:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGoToPanelization = () => {
    setActiveView("sip-panelization");
  };

  const currentStorey = currentPlan?.storeys.find((s) => s.id === currentStoreyId);
  const selectedWall = currentStorey?.walls.find((w) => w.id === selectedWallId);

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        Selecciona un proyecto para comenzar
      </div>
    );
  }

  // Plan selection screen
  if (!currentPlan) {
    return (
      <div className="max-w-lg mx-auto mt-20 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <PenTool size={32} className="text-[var(--primary)]" />
          <div>
            <h2 className="text-2xl font-bold">Plano de Planta</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Dibuja muros, coloca puertas y ventanas, y paneliza directamente
            </p>
          </div>
        </div>

        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--primary)]"
            onClick={() => loadPlan(plan.id)}
          >
            <div>
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {plan.storeys.length} pisos | {plan.storeys.reduce((a, s) => a + (s.walls?.length || 0), 0)} muros
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
              className="p-2 rounded hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {showNewPlan ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre del plano..."
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlan()}
              autoFocus
              className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded"
            />
            <button
              onClick={handleCreatePlan}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded"
            >
              Crear
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewPlan(true)}
            className="flex items-center gap-2 w-full p-4 border-2 border-dashed border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Plus size={20} />
            Nuevo Plano de Planta
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border-b border-[var(--border)] flex-shrink-0">
        {/* Tools */}
        <div className="flex gap-1 bg-[var(--secondary)] p-0.5 rounded">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded transition-colors ${
                activeTool === tool.id
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
              <span className="hidden lg:inline">{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Grid size */}
        <div className="flex items-center gap-1">
          <Grid3X3 size={14} className="text-[var(--muted-foreground)]" />
          <select
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            className="px-1.5 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded"
          >
            <option value={50}>50mm</option>
            <option value={100}>100mm</option>
            <option value={200}>200mm</option>
            <option value={500}>500mm</option>
          </select>
        </div>

        {/* Wall thickness */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">Espesor:</span>
          <select
            value={wallThickness}
            onChange={(e) => setWallThickness(Number(e.target.value))}
            className="px-1.5 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded"
          >
            <option value={90}>90mm (2x4)</option>
            <option value={114}>114mm (SIP 4")</option>
            <option value={140}>140mm (2x6)</option>
            <option value={150}>150mm (SIP 6")</option>
            <option value={165}>165mm (SIP 6.5")</option>
            <option value={210}>210mm (SIP 8")</option>
          </select>
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* View toggle */}
        <button
          onClick={() => setViewMode(viewMode === "2d" ? "3d" : "2d")}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded ${
            viewMode === "3d" ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)]"
          }`}
        >
          <Box size={14} />
          {viewMode === "2d" ? "Ver 3D" : "Ver 2D"}
        </button>

        <div className="flex-1" />

        {/* Generate + Go to panelization */}
        <button
          onClick={handleGenerateElements}
          disabled={generating || !currentPlan.storeys.some((s) => s.walls?.length > 0)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Generar Elementos
        </button>
        {currentPlan.ifc_model_id && (
          <button
            onClick={handleGoToPanelization}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded hover:opacity-90"
          >
            Panelizar
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-56 flex-shrink-0 border-r border-[var(--border)] overflow-y-auto p-3 space-y-4">
          {/* Plan name */}
          <div>
            <h3 className="text-sm font-bold text-[var(--primary)]">{currentPlan.name}</h3>
            <button
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              onClick={() => useFloorPlanStore.setState({ currentPlan: null })}
            >
              Cambiar plano
            </button>
          </div>

          {/* Storeys */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">Pisos</h4>
              <button
                onClick={async () => {
                  if (!currentPlan) return;
                  const idx = currentPlan.storeys.length;
                  await floorPlanApi.addStorey(currentPlan.id, {
                    name: `Piso ${idx + 1}`,
                    level_index: idx,
                    height_mm: currentPlan.default_wall_height_mm,
                  });
                  loadPlan(currentPlan.id);
                }}
                className="p-0.5 rounded hover:bg-[var(--secondary)] text-[var(--primary)]"
              >
                <Plus size={14} />
              </button>
            </div>
            {currentPlan.storeys.map((storey) => (
              <button
                key={storey.id}
                onClick={() => setCurrentStorey(storey.id)}
                className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded ${
                  currentStoreyId === storey.id
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "hover:bg-[var(--secondary)] text-[var(--foreground)]"
                }`}
              >
                <span>{storey.name}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {storey.walls?.length || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Walls */}
          {currentStorey && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-1">
                Muros ({currentStorey.walls?.length || 0})
              </h4>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {currentStorey.walls?.map((wall) => (
                  <button
                    key={wall.id}
                    onClick={() => setSelectedWall(wall.id)}
                    className={`flex items-center justify-between w-full px-2 py-1 text-xs rounded ${
                      selectedWallId === wall.id
                        ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "hover:bg-[var(--secondary)]"
                    }`}
                  >
                    <span className="font-mono">{wall.label}</span>
                    <span className="text-[var(--muted-foreground)]">{wall.length_mm.toFixed(0)}mm</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected wall properties */}
          {selectedWall && (
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                Propiedades: {selectedWall.label}
              </h4>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Largo</div>
                  <div className="font-mono">{selectedWall.length_mm.toFixed(0)} mm</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Espesor</div>
                  <div className="font-mono">{selectedWall.thickness_mm} mm</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Alto</div>
                  <div className="font-mono">{selectedWall.height_mm || currentStorey?.height_mm || 2440} mm</div>
                </div>
                <div className="bg-[var(--secondary)] rounded p-1.5">
                  <div className="text-[var(--muted-foreground)]">Vanos</div>
                  <div className="font-mono">{selectedWall.openings.length}</div>
                </div>
              </div>

              {/* Openings list */}
              {selectedWall.openings.length > 0 && (
                <div className="space-y-1">
                  {selectedWall.openings.map((op) => (
                    <div key={op.id} className="flex items-center justify-between text-xs bg-[var(--secondary)] rounded p-1.5">
                      <span>
                        {op.opening_type === "door" ? "Puerta" : "Ventana"} {op.width_mm}x{op.height_mm}
                      </span>
                      <button
                        onClick={() => deleteOpeningFromWall(op.id)}
                        className="p-0.5 rounded hover:bg-red-500/10 text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => deleteWallFromStorey(selectedWall.id)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20"
              >
                <Trash2 size={12} />
                Eliminar Muro
              </button>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <FloorPlanCanvas />
        </div>
      </div>
    </div>
  );
}
