import { useState, useEffect, useMemo } from "react";
import { Grid3X3, Check, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useIfcStore } from "../../store/ifc-store";
import { listElements } from "../../api/ifc-api";
import { listPanels } from "../../api/panels-api";
import { listAssignments, bulkAssign, deleteAssignment } from "../../api/panel-assignments-api";
import type { IfcElement, Panel, PanelAssignmentWithDetails } from "../../types/api";

export default function PanelAssignment() {
  const { currentProjectId } = useProjectStore();
  const { currentModelId, setSelectedElements } = useIfcStore();

  const [allElements, setAllElements] = useState<IfcElement[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [assignments, setAssignments] = useState<PanelAssignmentWithDetails[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<number>>(new Set());
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [expandedStoreys, setExpandedStoreys] = useState<Set<string>>(new Set());
  const [filterStorey, setFilterStorey] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  useEffect(() => {
    if (!currentProjectId || !currentModelId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      listElements(currentModelId, { limit: 5000 }),
      listPanels(currentProjectId),
      listAssignments(currentProjectId),
    ]).then(([els, pnls, asgns]) => {
      setAllElements(els);
      setPanels(pnls);
      setAssignments(asgns);

      // Expand all storeys by default
      const storeys = new Set(els.map((e) => e.storey_name || "Sin nivel"));
      setExpandedStoreys(storeys);

      setLoading(false);
    });
  }, [currentProjectId, currentModelId]);

  // Unique IFC types for filter
  const ifcTypes = useMemo(() => {
    const types = new Set(allElements.map((e) => e.ifc_type));
    return Array.from(types).sort();
  }, [allElements]);

  // Filtered elements
  const filteredElements = useMemo(() => {
    let result = allElements;
    if (filterType) result = result.filter((e) => e.ifc_type === filterType);
    if (filterStorey) result = result.filter((e) => (e.storey_name || "Sin nivel") === filterStorey);
    return result;
  }, [allElements, filterType, filterStorey]);

  // Group by storey
  const elementsByStorey = useMemo(() => {
    const groups: Record<string, IfcElement[]> = {};
    for (const el of filteredElements) {
      const storey = el.storey_name || "Sin nivel";
      if (!groups[storey]) groups[storey] = [];
      groups[storey].push(el);
    }
    return groups;
  }, [filteredElements]);

  const storeys = useMemo(() => {
    const s = new Set(allElements.map((e) => e.storey_name || "Sin nivel"));
    return Array.from(s).sort();
  }, [allElements]);

  const assignedElementIds = useMemo(
    () => new Set(assignments.map((a) => a.ifc_element_id)),
    [assignments]
  );

  const toggleStorey = (storey: string) => {
    setExpandedStoreys((prev) => {
      const next = new Set(prev);
      if (next.has(storey)) next.delete(storey);
      else next.add(storey);
      return next;
    });
  };

  const toggleElement = (elId: number) => {
    setSelectedElementIds((prev) => {
      const next = new Set(prev);
      if (next.has(elId)) next.delete(elId);
      else next.add(elId);
      return next;
    });
  };

  const selectAllInStorey = (storey: string) => {
    const storeyEls = elementsByStorey[storey] || [];
    const unassigned = storeyEls.filter((e) => !assignedElementIds.has(e.id));
    setSelectedElementIds((prev) => {
      const next = new Set(prev);
      for (const e of unassigned) next.add(e.id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!currentProjectId || !selectedPanelId || selectedElementIds.size === 0) return;
    setAssigning(true);
    try {
      await bulkAssign({
        project_id: currentProjectId,
        ifc_element_ids: Array.from(selectedElementIds),
        panel_id: selectedPanelId,
        notes: notes || undefined,
      });
      const asgns = await listAssignments(currentProjectId);
      setAssignments(asgns);
      setSelectedElementIds(new Set());
      setNotes("");
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (assignmentId: number) => {
    await deleteAssignment(assignmentId);
    if (currentProjectId) {
      const asgns = await listAssignments(currentProjectId);
      setAssignments(asgns);
    }
  };

  const handleElementClick = (el: IfcElement) => {
    setSelectedElements([el.global_id]);
  };

  if (!currentProjectId || !currentModelId) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-[var(--muted-foreground)]">
        <Grid3X3 size={48} className="mx-auto mb-3 opacity-50" />
        <p>Selecciona un proyecto e importa un modelo IFC para asignar paneles.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--muted-foreground)]">Cargando elementos...</div>;
  }

  const selectedPanel = panels.find((p) => p.id === selectedPanelId);
  const prefixMap: Record<string, string> = {
    exterior_wall: "EXT",
    interior_wall: "INT",
    partition: "PAR",
    floor: "FLR",
    roof: "ROF",
  };
  const previewPrefix = selectedPanel ? prefixMap[selectedPanel.category] || "PNL" : "";

  // Type label helper
  const shortType = (t: string) => t.replace("IfcWallStandardCase", "Muro Std").replace("Ifc", "");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Grid3X3 className="text-green-400" /> Asignaci&oacute;n de Paneles
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Asignar paneles SIP numerados a elementos del modelo ({allElements.length} elementos, {ifcTypes.length} tipos)
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left: Element list */}
        <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-sm">Elementos por Nivel</h3>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs"
            >
              <option value="">Todos los Tipos</option>
              {ifcTypes.map((t) => (
                <option key={t} value={t}>{t} ({allElements.filter((e) => e.ifc_type === t).length})</option>
              ))}
            </select>
            <select
              value={filterStorey}
              onChange={(e) => setFilterStorey(e.target.value)}
              className="bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs"
            >
              <option value="">Todos los Niveles</option>
              {storeys.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-[var(--muted-foreground)] ml-auto">
              {selectedElementIds.size} seleccionados | {filteredElements.length} visibles
            </span>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
            {Object.entries(elementsByStorey).map(([storey, storeyEls]) => (
              <div key={storey}>
                <button
                  onClick={() => toggleStorey(storey)}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-sm font-medium"
                >
                  {expandedStoreys.has(storey) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{storey}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">({storeyEls.length} elementos)</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); selectAllInStorey(storey); }}
                    className="ml-auto text-xs text-blue-400 hover:text-blue-300"
                  >
                    Seleccionar sin asignar
                  </button>
                </button>

                {expandedStoreys.has(storey) && storeyEls.map((el) => {
                  const isAssigned = assignedElementIds.has(el.id);
                  const assignment = assignments.find((a) => a.ifc_element_id === el.id);
                  const isSelected = selectedElementIds.has(el.id);

                  return (
                    <div
                      key={el.id}
                      className={`flex items-center gap-3 px-4 py-2 text-sm border-b border-[var(--border)]/50 cursor-pointer hover:bg-[var(--secondary)]/50 ${
                        isSelected ? "bg-blue-500/10" : ""
                      }`}
                      onClick={() => handleElementClick(el)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isAssigned}
                        onChange={(e) => { e.stopPropagation(); toggleElement(el.id); }}
                        className="accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{el.name || el.global_id}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          <span className="inline-block px-1.5 py-0 rounded bg-blue-500/15 text-blue-400 mr-1.5">
                            {shortType(el.ifc_type)}
                          </span>
                          {el.type_name && <span className="mr-1.5">{el.type_name}</span>}
                          {el.gross_area_m2 != null && <span className="font-mono">{el.gross_area_m2.toFixed(1)} m2</span>}
                        </div>
                      </div>
                      {isAssigned ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded text-xs bg-green-600/20 text-green-400 font-mono">
                            {assignment?.panel_number}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (assignment) handleDelete(assignment.id); }}
                            className="text-[var(--muted-foreground)] hover:text-red-400 p-0.5"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-orange-600/20 text-orange-400">
                          Sin asignar
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {filteredElements.length === 0 && (
              <div className="text-center py-8 text-[var(--muted-foreground)] text-sm">
                No se encontraron elementos con los filtros actuales.
              </div>
            )}
          </div>
        </div>

        {/* Right: Assignment panel */}
        <div className="w-80 space-y-4">
          {/* Panel type selector */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Asignar Tipo de Panel</h3>
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Tipo de Panel</label>
              <select
                value={selectedPanelId ?? ""}
                onChange={(e) => setSelectedPanelId(parseInt(e.target.value) || null)}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm"
              >
                <option value="">Seleccionar tipo de panel...</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            {selectedPanel && (
              <div className="bg-[var(--secondary)] rounded p-3 text-xs space-y-1">
                <div>Categor&iacute;a: <span className="text-purple-400">{selectedPanel.category.replace("_", " ")}</span></div>
                <div>Espesor: <span className="font-mono">{selectedPanel.total_thickness_mm?.toFixed(1) || "\u2014"} mm</span></div>
                <div>Peso: <span className="font-mono">{selectedPanel.total_weight_per_m2_kg?.toFixed(2) || "\u2014"} kg/m2</span></div>
                <div>Vista previa #: <span className="font-mono text-green-400">{previewPrefix}-###</span></div>
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm h-16 resize-none"
                placeholder="Notas de montaje..."
              />
            </div>

            <button
              onClick={handleAssign}
              disabled={!selectedPanelId || selectedElementIds.size === 0 || assigning}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              <Check size={16} />
              {assigning ? "Asignando..." : `Asignar ${selectedElementIds.size} Elemento${selectedElementIds.size !== 1 ? "s" : ""}`}
            </button>
          </div>

          {/* Assignment summary */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Resumen de Asignaciones</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-[var(--secondary)] rounded p-2">
                <div className="font-mono font-bold text-green-400">{assignments.length}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Asignados</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-2">
                <div className="font-mono font-bold text-orange-400">{allElements.length - assignments.length}</div>
                <div className="text-xs text-[var(--muted-foreground)]">Sin asignar</div>
              </div>
            </div>
            {/* Breakdown by type */}
            {assignments.length > 0 && (
              <div className="space-y-1">
                {Object.entries(
                  assignments.reduce<Record<string, number>>((acc, a) => {
                    const prefix = a.panel_number.split("-")[0];
                    acc[prefix] = (acc[prefix] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([prefix, count]) => (
                  <div key={prefix} className="flex justify-between text-xs">
                    <span className="font-mono text-purple-400">{prefix}</span>
                    <span className="text-[var(--muted-foreground)]">{count} paneles</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent assignments */}
          {assignments.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Asignaciones Recientes</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {assignments.slice(-10).reverse().map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs bg-[var(--secondary)] rounded px-2 py-1.5">
                    <span className="font-mono text-green-400">{a.panel_number}</span>
                    <span className="flex-1 truncate text-[var(--muted-foreground)]">
                      {a.element_name || a.element_global_id}
                    </span>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-[var(--muted-foreground)] hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
