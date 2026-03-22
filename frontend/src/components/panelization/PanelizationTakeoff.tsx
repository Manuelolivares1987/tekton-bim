import { useState, useEffect } from "react";
import {
  ClipboardList,
  Download,
  Loader2,
  Package,
  Building2,
  BarChart3,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import client from "../../api/client";

type TabType = "per-panel" | "per-wall" | "summary";

interface MaterialItem {
  material_name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  cost: number;
}

export default function PanelizationTakeoff() {
  const { currentProjectId } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [wasteFactor, setWasteFactor] = useState(1.1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Data
  const [summary, setSummary] = useState<any>(null);
  const [perWall, setPerWall] = useState<any[]>([]);
  const [perPanel, setPerPanel] = useState<any[]>([]);

  useEffect(() => {
    if (!currentProjectId) return;
    loadData();
  }, [currentProjectId, wasteFactor]);

  const loadData = async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [summaryRes, wallRes, panelRes] = await Promise.all([
        client.get(`/panelization/takeoff/${currentProjectId}/summary`, { params: { waste_factor: wasteFactor } }),
        client.get(`/panelization/takeoff/${currentProjectId}/per-wall`, { params: { waste_factor: wasteFactor } }),
        client.get(`/panelization/takeoff/${currentProjectId}/per-panel`, { params: { waste_factor: wasteFactor } }),
      ]);
      setSummary(summaryRes.data);
      setPerWall(wallRes.data);
      setPerPanel(panelRes.data);
    } catch (err) {
      console.error("Error loading takeoff:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentProjectId) return;
    setExporting(true);
    try {
      const res = await client.get(`/panelization/takeoff/${currentProjectId}/export-excel`, {
        params: { waste_factor: wasteFactor },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `cubicacion_paneles_${currentProjectId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting:", err);
    } finally {
      setExporting(false);
    }
  };

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        Selecciona un proyecto para ver la cubicación
      </div>
    );
  }

  const tabs = [
    { id: "summary" as TabType, label: "Resumen", icon: <BarChart3 size={16} /> },
    { id: "per-wall" as TabType, label: "Por Muro", icon: <Building2 size={16} /> },
    { id: "per-panel" as TabType, label: "Por Panel", icon: <Package size={16} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList size={24} className="text-[var(--primary)]" />
          <div>
            <h2 className="text-xl font-bold">Cubicación de Paneles</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Desglose detallado de materiales por panel, muro y proyecto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--muted-foreground)]">Desperdicio:</label>
            <input
              type="range"
              min={1.0}
              max={1.5}
              step={0.05}
              value={wasteFactor}
              onChange={(e) => setWasteFactor(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm font-mono w-10">{((wasteFactor - 1) * 100).toFixed(0)}%</span>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || !summary}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--secondary)] p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <>
          {/* Summary Tab */}
          {activeTab === "summary" && summary && (
            <div className="space-y-4">
              {/* Stats cards */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: "Muros", value: summary.total_walls },
                  { label: "Paneles", value: summary.total_panels },
                  { label: "Area (m²)", value: summary.total_area_m2.toFixed(1) },
                  { label: "Peso (kg)", value: summary.total_weight_kg.toFixed(0) },
                  { label: "Costo total", value: `$${summary.total_cost.toFixed(0)}` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-[var(--primary)]">{stat.value}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* By storey */}
              {summary.by_storey && Object.keys(summary.by_storey).length > 0 && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Por Piso</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(summary.by_storey).map(([storey, data]: [string, any]) => (
                      <div key={storey} className="bg-[var(--secondary)] rounded p-3">
                        <div className="font-medium text-sm">{storey}</div>
                        <div className="text-xs text-[var(--muted-foreground)] mt-1">
                          {data.panels} paneles | {data.area_m2.toFixed(1)} m² | {data.weight_kg.toFixed(0)} kg
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials table */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                <h3 className="font-semibold mb-3">Lista de Materiales</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                      <th className="py-2 px-2">Material</th>
                      <th className="py-2 px-2">Categoría</th>
                      <th className="py-2 px-2 text-right">Cantidad</th>
                      <th className="py-2 px-2">Unidad</th>
                      <th className="py-2 px-2 text-right">Costo unit.</th>
                      <th className="py-2 px-2 text-right">Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.materials.map((mat: MaterialItem, i: number) => (
                      <tr key={i} className="border-b border-[var(--border)]/50">
                        <td className="py-1.5 px-2 font-medium">{mat.material_name}</td>
                        <td className="py-1.5 px-2 capitalize text-[var(--muted-foreground)]">{mat.category}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{mat.quantity}</td>
                        <td className="py-1.5 px-2">{mat.unit}</td>
                        <td className="py-1.5 px-2 text-right font-mono">${mat.cost_per_unit}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold">${mat.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-[var(--border)]">
                      <td className="py-2 px-2" colSpan={5}>Total</td>
                      <td className="py-2 px-2 text-right font-mono">${summary.total_cost.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Per Wall Tab */}
          {activeTab === "per-wall" && (
            <div className="space-y-3">
              {perWall.map((wall, i) => (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{wall.wall_name}</h4>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {wall.storey} | {wall.panel_count} paneles | {wall.config_type.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right text-sm">
                      <div>{wall.total_area_m2} m²</div>
                      <div className="text-[var(--muted-foreground)]">{wall.total_weight_kg} kg</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {wall.materials.map((mat: MaterialItem, j: number) => (
                      <div key={j} className="bg-[var(--secondary)] rounded p-2">
                        <div className="font-medium truncate">{mat.material_name}</div>
                        <div className="text-[var(--muted-foreground)]">
                          {mat.quantity} {mat.unit} | ${mat.cost}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {perWall.length === 0 && (
                <p className="text-center text-[var(--muted-foreground)] py-10">
                  No hay muros panelizados. Ve a Panelización SIP primero.
                </p>
              )}
            </div>
          )}

          {/* Per Panel Tab */}
          {activeTab === "per-panel" && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted-foreground)] bg-[var(--secondary)]">
                    <th className="py-2 px-3">Panel</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Muro</th>
                    <th className="py-2 px-3">Piso</th>
                    <th className="py-2 px-3 text-right">Area (m²)</th>
                    <th className="py-2 px-3 text-right">Peso (kg)</th>
                    <th className="py-2 px-3">Materiales</th>
                  </tr>
                </thead>
                <tbody>
                  {perPanel.map((panel, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--secondary)]">
                      <td className="py-1.5 px-3 font-mono font-semibold">{panel.panel_label}</td>
                      <td className="py-1.5 px-3 capitalize">{panel.panel_type}</td>
                      <td className="py-1.5 px-3">{panel.wall_name}</td>
                      <td className="py-1.5 px-3">{panel.storey}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{panel.area_m2.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{panel.weight_kg.toFixed(1)}</td>
                      <td className="py-1.5 px-3 text-xs text-[var(--muted-foreground)]">
                        {panel.materials.map((m: MaterialItem) => `${m.quantity} ${m.unit} ${m.material_name}`).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {perPanel.length === 0 && (
                <p className="text-center text-[var(--muted-foreground)] py-10">
                  No hay paneles. Paneliza muros primero.
                </p>
              )}
            </div>
          )}

          {/* No data state */}
          {!summary && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
              <ClipboardList size={48} className="opacity-30 mb-4" />
              <p className="text-lg">Sin datos de cubicación</p>
              <p className="text-sm mt-1">Paneliza muros en la vista "Panelización SIP" primero</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
