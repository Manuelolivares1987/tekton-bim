import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Loader2,
  ClipboardList,
  Package,
  BarChart3,
  Factory,
  Ruler,
  Weight,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import {
  getPanelSchedule,
  getMaterialBOM,
  getAssemblySummary,
  getAssemblyPdfUrl,
} from "../../api/assembly-plans-api";
import type {
  PanelScheduleResponse,
  MaterialBOMResponse,
  AssemblySummaryResponse,
  PanelScheduleItem,
} from "../../types/api";

type Tab = "production" | "bom" | "summary";

export default function AssemblyPlans() {
  const { currentProjectId, getCurrentProject } = useProjectStore();
  const [tab, setTab] = useState<Tab>("production");
  const [schedule, setSchedule] = useState<PanelScheduleResponse | null>(null);
  const [bom, setBom] = useState<MaterialBOMResponse | null>(null);
  const [summary, setSummary] = useState<AssemblySummaryResponse | null>(null);
  const [wasteFactor, setWasteFactor] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [storeyFilter, setStoreyFilter] = useState<string>("all");

  const project = getCurrentProject();

  useEffect(() => {
    if (!currentProjectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      getPanelSchedule(currentProjectId),
      getMaterialBOM(currentProjectId, wasteFactor),
      getAssemblySummary(currentProjectId),
    ])
      .then(([s, b, sm]) => {
        setSchedule(s);
        setBom(b);
        setSummary(sm);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentProjectId, wasteFactor]);

  const handleDownloadPdf = () => {
    if (!currentProjectId) return;
    const url = getAssemblyPdfUrl(currentProjectId, wasteFactor);
    window.open(url, "_blank");
  };

  // Get unique storeys from schedule
  const storeys = schedule
    ? [...new Set(schedule.items.map((i) => i.storey || "Sin nivel"))].sort()
    : [];

  // Filter items by storey
  const filteredItems = schedule
    ? storeyFilter === "all"
      ? schedule.items
      : schedule.items.filter(
          (i) => (i.storey || "Sin nivel") === storeyFilter
        )
    : [];

  // Production stats from filtered items
  const totalWeight = filteredItems.reduce(
    (sum, i) => sum + (i.weight_kg || 0),
    0
  );
  const totalArea = filteredItems.reduce(
    (sum, i) => sum + (i.area_m2 || 0),
    0
  );

  if (!currentProjectId) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-[var(--muted-foreground)]">
        <Factory size={48} className="mx-auto mb-3 opacity-50" />
        <p>Selecciona un proyecto para ver el plan de producción.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-[var(--muted-foreground)]">
        <Loader2 className="animate-spin" size={20} /> Cargando plan de
        producción...
      </div>
    );
  }

  const tabs = [
    {
      id: "production" as Tab,
      label: "Plan de Producción",
      icon: <Factory size={16} />,
    },
    {
      id: "bom" as Tab,
      label: "Lista de Materiales",
      icon: <Package size={16} />,
    },
    {
      id: "summary" as Tab,
      label: "Resumen",
      icon: <BarChart3 size={16} />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="text-indigo-400" /> Plan de Producción y Montaje
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Orden de producción de paneles SIP para{" "}
            {project?.name || "proyecto"}
          </p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={!schedule || schedule.total_panels === 0}
          className="flex items-center gap-2 bg-[var(--primary)] text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          <Download size={16} /> Exportar PDF
        </button>
      </div>

      {/* Production summary cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={14} className="text-blue-400" />
              <span className="text-xs text-[var(--muted-foreground)] uppercase">
                Paneles
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-blue-400">
              {summary.total_panels}
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ruler size={14} className="text-green-400" />
              <span className="text-xs text-[var(--muted-foreground)] uppercase">
                Área Total
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-green-400">
              {summary.total_area_m2.toFixed(1)}
              <span className="text-sm font-normal"> m²</span>
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Weight size={14} className="text-amber-400" />
              <span className="text-xs text-[var(--muted-foreground)] uppercase">
                Peso Total
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-amber-400">
              {totalWeight.toFixed(0)}
              <span className="text-sm font-normal"> kg</span>
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={14} className="text-purple-400" />
              <span className="text-xs text-[var(--muted-foreground)] uppercase">
                Tipos
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-purple-400">
              {Object.keys(summary.by_panel_type).length}
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-orange-400" />
              <span className="text-xs text-[var(--muted-foreground)] uppercase">
                Costo Mat.
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-orange-400">
              ${summary.total_material_cost.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--secondary)] p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm transition-colors ${
              tab === t.id
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ========== PRODUCTION TAB ========== */}
      {tab === "production" && schedule && (
        <div className="space-y-4">
          {/* Storey filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filtrar por nivel:</label>
            <select
              value={storeyFilter}
              onChange={(e) => setStoreyFilter(e.target.value)}
              className="bg-[var(--card)] border border-[var(--border)] rounded px-3 py-1.5 text-sm"
            >
              <option value="all">
                Todos los niveles ({schedule.items.length})
              </option>
              {storeys.map((s) => (
                <option key={s} value={s}>
                  {s} (
                  {
                    schedule.items.filter(
                      (i) => (i.storey || "Sin nivel") === s
                    ).length
                  }
                  )
                </option>
              ))}
            </select>
            <span className="text-sm text-[var(--muted-foreground)]">
              Mostrando {filteredItems.length} de {schedule.items.length} paneles
            </span>
          </div>

          {/* Production table */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--secondary)]">
                    <th className="text-left px-3 py-3 font-medium">#</th>
                    <th className="text-left px-3 py-3 font-medium">
                      ID Panel
                    </th>
                    <th className="text-left px-3 py-3 font-medium">
                      Tipo Panel
                    </th>
                    <th className="text-right px-3 py-3 font-medium">
                      Ancho (m)
                    </th>
                    <th className="text-right px-3 py-3 font-medium">
                      Alto (m)
                    </th>
                    <th className="text-right px-3 py-3 font-medium">
                      Espesor (mm)
                    </th>
                    <th className="text-right px-3 py-3 font-medium">
                      Área (m²)
                    </th>
                    <th className="text-right px-3 py-3 font-medium">
                      Peso (kg)
                    </th>
                    <th className="text-left px-3 py-3 font-medium">
                      Destino
                    </th>
                    <th className="text-left px-3 py-3 font-medium">Nivel</th>
                    <th className="text-left px-3 py-3 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, i) => (
                    <tr
                      key={i}
                      className="border-t border-[var(--border)]/50 hover:bg-[var(--secondary)]/50"
                    >
                      <td className="px-3 py-2.5 text-[var(--muted-foreground)] text-xs">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-green-400">
                        {item.panel_number}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          {item.panel_name || item.panel_category.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {item.width_m != null ? item.width_m.toFixed(3) : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {item.height_m != null
                          ? item.height_m.toFixed(3)
                          : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {item.thickness_mm != null
                          ? item.thickness_mm.toFixed(1)
                          : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {item.area_m2 != null ? item.area_m2.toFixed(2) : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">
                        {item.weight_kg != null
                          ? item.weight_kg.toFixed(1)
                          : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {item.element_name || "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[var(--muted-foreground)]">
                        {item.storey || "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted-foreground)] text-xs">
                        {item.notes || ""}
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-8 text-center text-[var(--muted-foreground)]"
                      >
                        No hay asignaciones de paneles aún. Usa Asignación de
                        Paneles primero.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredItems.length > 0 && (
              <div className="px-4 py-3 bg-[var(--secondary)] text-sm flex justify-between">
                <span className="text-[var(--muted-foreground)]">
                  {filteredItems.length} paneles
                </span>
                <div className="flex gap-6 font-mono">
                  <span>
                    Área: <strong>{totalArea.toFixed(1)} m²</strong>
                  </span>
                  <span>
                    Peso: <strong>{totalWeight.toFixed(0)} kg</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Production grouping by panel type */}
          {schedule.items.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Factory size={14} className="text-indigo-400" />
                Resumen de Producción por Tipo
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-3 py-2 font-medium">
                        Tipo de Panel
                      </th>
                      <th className="text-right px-3 py-2 font-medium">
                        Cantidad
                      </th>
                      <th className="text-right px-3 py-2 font-medium">
                        Área Total (m²)
                      </th>
                      <th className="text-right px-3 py-2 font-medium">
                        Peso Total (kg)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupByPanelType(schedule.items).map((group) => (
                      <tr
                        key={group.name}
                        className="border-t border-[var(--border)]/30"
                      >
                        <td className="px-3 py-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                            {group.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {group.count}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {group.totalArea.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {group.totalWeight.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== BOM TAB ========== */}
      {tab === "bom" && bom && (
        <div className="space-y-4">
          {/* Waste factor slider */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex items-center gap-4">
            <label className="text-sm font-medium">
              Factor de Desperdicio:
            </label>
            <input
              type="range"
              min={1}
              max={1.5}
              step={0.05}
              value={wasteFactor}
              onChange={(e) => setWasteFactor(parseFloat(e.target.value))}
              className="flex-1 accent-green-500"
            />
            <span className="font-mono text-sm w-16 text-right">
              {((wasteFactor - 1) * 100).toFixed(0)}%
            </span>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--secondary)]">
                    <th className="text-left px-4 py-3 font-medium">
                      Material
                    </th>
                    <th className="text-left px-4 py-3 font-medium">
                      Categoría
                    </th>
                    <th className="text-right px-4 py-3 font-medium">
                      Cantidad
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Unidad</th>
                    <th className="text-right px-4 py-3 font-medium">
                      Costo/Unidad
                    </th>
                    <th className="text-right px-4 py-3 font-medium">
                      Costo Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bom.items.map((item, i) => (
                    <tr
                      key={i}
                      className="border-t border-[var(--border)]/50 hover:bg-[var(--secondary)]/50"
                    >
                      <td className="px-4 py-2.5">{item.material_name}</td>
                      <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                        {item.category}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {item.quantity.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-4 py-2.5">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {item.cost_per_unit != null
                          ? `$${item.cost_per_unit.toFixed(2)}`
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">
                        {item.total_cost != null
                          ? `$${item.total_cost.toLocaleString()}`
                          : "\u2014"}
                      </td>
                    </tr>
                  ))}
                  {bom.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[var(--muted-foreground)]"
                      >
                        Sin datos de materiales. Asigna paneles a elementos
                        primero.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {bom.items.length > 0 && (
              <div className="px-4 py-3 bg-[var(--secondary)] text-sm flex justify-between">
                <span className="text-[var(--muted-foreground)]">
                  {bom.items.length} materiales | Desperdicio:{" "}
                  {((bom.waste_factor - 1) * 100).toFixed(0)}%
                </span>
                <span className="font-mono font-bold text-green-400">
                  Total: ${bom.total_cost.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== SUMMARY TAB ========== */}
      {tab === "summary" && summary && (
        <div className="grid grid-cols-2 gap-6">
          {/* By panel type */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Por Tipo de Panel</h3>
            <div className="space-y-2">
              {Object.entries(summary.by_panel_type).map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${(count / summary.total_panels) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {Object.keys(summary.by_panel_type).length === 0 && (
                <div className="text-sm text-[var(--muted-foreground)] text-center py-4">
                  Sin datos
                </div>
              )}
            </div>
          </div>

          {/* By storey */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Por Nivel</h3>
            <div className="space-y-2">
              {Object.entries(summary.by_storey).map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${(count / summary.total_panels) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {Object.keys(summary.by_storey).length === 0 && (
                <div className="text-sm text-[var(--muted-foreground)] text-center py-4">
                  Sin datos
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Group schedule items by panel type and aggregate stats */
function groupByPanelType(items: PanelScheduleItem[]) {
  const groups: Record<
    string,
    { name: string; count: number; totalArea: number; totalWeight: number }
  > = {};
  for (const item of items) {
    const key = item.panel_name || item.panel_category;
    if (!groups[key]) {
      groups[key] = { name: key, count: 0, totalArea: 0, totalWeight: 0 };
    }
    groups[key].count++;
    groups[key].totalArea += item.area_m2 || 0;
    groups[key].totalWeight += item.weight_kg || 0;
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}
